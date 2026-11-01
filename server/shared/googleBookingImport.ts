import {googleReferences} from "./googleCalendars.ts";
export function remoteState(event){
 if(event.status==="cancelled")return {status:"cancelled"};
 const start=Date.parse(event.start?.dateTime),end=Date.parse(event.end?.dateTime);
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)throw Error("external_sync_all_day");
 const url=event.hangoutLink || event.conferenceData?.entryPoints?.find(e=>e.entryPointType==="video")?.uri || "";
 return {status:"active",start_at:new Date(start).toISOString(),end_at:new Date(end).toISOString(),meeting_url:/^https:\/\//.test(url)?url:""};
}
const key=r=>r.calendar_id+"/"+r.event_id;
const signature=s=>JSON.stringify(s);
export function planGoogleImport(booking,events){
 let baseline={};try{baseline=JSON.parse(booking.google_import_snapshot || "{}") || {};}catch{}
 const current={status:booking.status==="cancelled"?"cancelled":"active",start_at:new Date(booking.start_at).toISOString(),end_at:new Date(booking.end_at).toISOString()};
 const differs=s=>s.status!==current.status || (s.status!=="cancelled" && (s.start_at!==current.start_at || s.end_at!==current.end_at));
 const snapshots=Object.fromEntries(events.map(({ref,state})=>[key(ref),state]));
 const changed=events.filter(({ref,state})=>baseline[key(ref)]?signature(state)!==signature(baseline[key(ref)]):differs(state));
 const candidates=changed.filter(e=>differs(e.state));
 const timeKey=s=>s.status==="cancelled"?"cancelled":s.start_at+"/"+s.end_at;
 if(new Set(candidates.map(e=>timeKey(e.state))).size>1)throw Error("external_sync_conflict");
 if(candidates.length && !booking.google_import_snapshot && ["pending","partial","failed","skipped"].includes(booking.calendar_sync_status))throw Error("external_sync_conflict");
 const chosen=candidates[0]?.state;
 if(chosen?.status!=="cancelled" && chosen && current.status==="cancelled")throw Error("external_sync_conflict");
 const patch={google_import_snapshot:JSON.stringify(snapshots)};
 if(chosen?.status==="cancelled")patch.status="cancelled";
 else if(chosen)Object.assign(patch,{start_at:chosen.start_at,end_at:chosen.end_at,duration:(Date.parse(chosen.end_at)-Date.parse(chosen.start_at))/60000,status:"rescheduled"});
 const primary=events.find(e=>e.ref.primary),url=primary?.state.meeting_url;
 if(url && url!==booking.meeting_url)patch.meeting_url=url;
 return {patch,changed:!!chosen || !!patch.meeting_url};
}
export async function importGoogleBooking(platform,booking,accessToken,transport=fetch){
 const db=platform.asServiceRole.entities,refs=googleReferences(booking),now=Date.now();
 if(booking.deletion_pending || !refs.length)return {id:booking.id,status:"unlinked"};
 if(refs.length>4)return {id:booking.id,status:"external_sync_limit"};
 if(Date.parse(booking.external_retry_at || "")>now)return {id:booking.id,status:"external_sync_rate_limit"};
 if(now-Date.parse(booking.external_checked_at || "")<30000)return {id:booking.id,status:booking.external_sync_status || "cached"};
 const events=[];
 try{
  const deadline=AbortSignal.timeout(12000);
  for(const ref of refs){
   const response=await transport("https://www.googleapis.com/calendar/v3/calendars/"+encodeURIComponent(ref.calendar_id)+"/events/"+encodeURIComponent(ref.event_id),{headers:{Authorization:"Bearer "+accessToken},signal:deadline});
   if(response.status===429){const e=new Error("external_sync_rate_limit");e.retryAfter=response.headers.get("Retry-After");throw e;}
   if(!response.ok)throw Error(response.status===404||response.status===410?"external_sync_missing":"external_sync_failed");
   events.push({ref,state:remoteState(await response.json())});
  }
  const plan=planGoogleImport(booking,events);
  const fresh=await db.Booking.get(booking.id);
  if(Date.parse(fresh.start_at)!==Date.parse(booking.start_at) || Date.parse(fresh.end_at)!==Date.parse(booking.end_at) || fresh.status!==booking.status || (fresh.notification_revision || "")!==(booking.notification_revision || "") || fresh.deletion_pending)throw Error("external_sync_conflict");
  await db.Booking.update(booking.id,{...plan.patch,external_checked_at:new Date().toISOString(),external_sync_status:plan.changed?"imported":"unchanged",external_observed:JSON.stringify(events)});
  return {id:booking.id,status:plan.changed?"imported":"unchanged"};
 }catch(e){
  const status=String(e.message).startsWith("external_sync_")?e.message:"external_sync_failed";
  const retryAt=status==="external_sync_rate_limit"?new Date(Math.max(Date.now()+60000,Number.isFinite(Number(e.retryAfter))?Date.now()+Number(e.retryAfter)*1000:Date.parse(e.retryAfter)||0)).toISOString():"";
  await db.Booking.update(booking.id,{external_checked_at:new Date().toISOString(),external_sync_status:status,external_retry_at:retryAt,external_observed:JSON.stringify(events)});
  return {id:booking.id,status,...(e.retryAfter?{retry_after:e.retryAfter}:{})};
 }
}
