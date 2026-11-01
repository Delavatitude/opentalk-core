import { PRODUCT_CONFIG } from "./productConfig.ts";
import {zonedToUTC} from "./time.ts";
// One saved reference per target. The first target owns the guest invitation and Meet.
export function googleReferences(b) {
 if(Array.isArray(b.google_calendar_events) && b.google_calendar_events.length)return b.google_calendar_events.map(r=>({...r}));
 return b.calendar_event_id?[{calendar_id:b.calendar_id || "primary",event_id:b.calendar_event_id,primary:true,status:"pending"}]:[];
}
export async function googleEventId(id) {
 return "b44"+[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(id)))].map(v=>v.toString(16).padStart(2,"0")).join("");
}
export async function syncGoogleCalendars(platform, bookingId, transport = fetch, options = {}) {
 const entity=platform.asServiceRole.entities.Booking;
 let failed=false;
 let b=await entity.get(bookingId), refs=googleReferences(b).map(r=>({...r,status:"pending"})), meetingUrl=b.meeting_url || b.location_value || "";
 try {
  if(!refs.length && b.status!=="cancelled"){
   const connections=await platform.asServiceRole.entities.CalendarConnection.filter({active:true,creates_events:true});
   const targets=[...new Set(connections.filter(c=>(!c.provider || c.provider==="google") && c.calendar_id).map(c=>c.calendar_id))];
   const eventId=await googleEventId(b.id);
   refs=targets.map((id,i)=>({calendar_id:id,event_id:eventId,primary:i===0,status:"pending"}));
  }
  // Persist destinations BEFORE making requests, including IDs for ambiguous timeouts.
  await entity.update(b.id,{google_calendar_events:refs,calendar_sync_status:refs.length?"pending":"disabled"});
  if(!refs.length)return {status:"disabled",meeting_url:meetingUrl};
  const {accessToken}=await platform.asServiceRole.connectors.getConnection("googlecalendar");
  const call=async(url,method="GET",body=undefined)=>{
   const response=await transport(url,{method,headers:{Authorization:`Bearer ${accessToken}`,"Content-Type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
   if(!response.ok){const e=new Error(response.status===403?"google_calendar_permission":"google_calendar_failed");e.status=response.status;throw e;}
   return response.status===204?{}:response.json();
  };
  for(const ref of refs) {
   try {
    b=await entity.get(bookingId);
    const root="https://www.googleapis.com/calendar/v3/calendars/"+encodeURIComponent(ref.calendar_id)+"/events";
    let url=root+"/"+encodeURIComponent(ref.event_id);
    const notify=ref.primary && (options.notifyEmail ?? b.notify_email)!==false ? "all":"none";
    if(b.status==="cancelled"){
     try{await call(url+"?sendUpdates="+notify,"DELETE");}catch(e){if(![404,410].includes(e.status))throw e;}
     ref.status="synced";ref.error="";
    }else{
     let event;
     try{event=await call(url);}catch(e){if(e.status!==404)throw e;}
     if(event?.status==="cancelled"){
      if(ref.primary)throw new Error("google_event_cancelled");
      ref.event_id=await googleEventId(b.id+":"+ref.calendar_id+":replacement");
      url=root+"/"+encodeURIComponent(ref.event_id);
      try{event=await call(url);}catch(e){if(e.status!==404)throw e;}
      if(event?.status==="cancelled")throw new Error("google_event_cancelled");
     }
     const body={
      summary:"["+String(b.context || "general").toUpperCase()+"] "+b.booking_type_name+" · "+b.name,
      description:[b.topic || "",b.company || "",!ref.primary && meetingUrl?"Meeting: "+meetingUrl:""].filter(Boolean).join("\n"),
      start:{dateTime:b.start_at,timeZone:"UTC"},end:{dateTime:b.end_at,timeZone:"UTC"},
      location:meetingUrl || b.location_value || "",
      attendees:event?.attendees || (ref.primary && (options.notifyEmail ?? b.notify_email)!==false?[{email:b.email}]:[]),
      extendedProperties:{private:{bookingSource:PRODUCT_CONFIG.calendarSource,bookingId:b.id}}
     };
     if(!event) {
      const create={...body,id:ref.event_id};
      if(ref.primary && b.location_type==="google_meet")create.conferenceData={createRequest:{requestId:ref.event_id,conferenceSolutionKey:{type:"hangoutsMeet"}}};
      try{event=await call(root+"?conferenceDataVersion=1&sendUpdates="+notify,"POST",create);}
      catch(e){if(e.status!==409)throw e;event=await call(url);}
     }
     if(event.status==="cancelled")throw new Error("google_event_cancelled");
     if(Date.parse(event.start?.dateTime)!==Date.parse(b.start_at) || Date.parse(event.end?.dateTime)!==Date.parse(b.end_at) || event.summary!==body.summary || (!ref.primary && event.location!==body.location)){
      event=await call(url+"?conferenceDataVersion=1&sendUpdates="+notify,"PATCH",body);
     }
     if(ref.primary){
      meetingUrl=event.hangoutLink || event.conferenceData?.entryPoints?.find(e=>e.entryPointType==="video")?.uri || meetingUrl;
      await entity.update(b.id,{calendar_id:ref.calendar_id,calendar_event_id:ref.event_id,meeting_url:meetingUrl});
     }
     ref.status="synced";ref.error="";
    }
   }catch(error){ref.status="failed";ref.error=["google_calendar_permission","google_event_cancelled"].includes(error.message)?error.message:"google_calendar_failed";}
   await entity.update(b.id,{google_calendar_events:refs});
  }
 }catch {
  failed=true;
  for(const ref of refs)if(ref.status!=="synced"){ref.status="failed";ref.error="google_calendar_failed";}
 }
 const ok=refs.filter(r=>r.status==="synced").length;
 const status=!refs.length?(failed?"failed":"disabled"):ok===refs.length?"synced":ok?"partial":"failed";
 try{await entity.update(bookingId,{google_calendar_events:refs,calendar_sync_status:status});}catch{}
 return {status,meeting_url:meetingUrl,synced:ok,total:refs.length};
}
export async function googleBusyForReschedule(platform, booking, from, to) {
 const connections=(await platform.asServiceRole.entities.CalendarConnection.filter({active:true,blocks_availability:true})).filter(c=>(!c.provider || c.provider==="google") && c.calendar_id);
 if(!connections.length)return [];
 const refs=googleReferences(booking),{accessToken}=await platform.asServiceRole.connectors.getConnection("googlecalendar");
 const busy=[];
 for(const calendarId of new Set(connections.map(c=>c.calendar_id))){
  let pageToken;
  do{
   const params=new URLSearchParams({timeMin:from,timeMax:to,singleEvents:"true",maxResults:"2500"});
   if(pageToken)params.set("pageToken",pageToken);
   const response=await fetch("https://www.googleapis.com/calendar/v3/calendars/"+encodeURIComponent(calendarId)+"/events?"+params,{headers:{Authorization:`Bearer ${accessToken}`},signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw new Error("google_calendar_failed");
   const data=await response.json();
   for(const e of data.items || []){
    if(e.status==="cancelled" || e.transparency==="transparent" || refs.some(r=>r.calendar_id===calendarId && r.event_id===e.id))continue;
    const instant=v=>v.dateTime || zonedToUTC(v.date,"00:00",data.timeZone || "UTC").toISOString();
    busy.push({start:instant(e.start),end:instant(e.end)});
   }
   if(data.nextPageToken && data.nextPageToken===pageToken)throw new Error("google_calendar_failed");
   pageToken=data.nextPageToken;
  }while(pageToken);
 }
 return busy;
}

