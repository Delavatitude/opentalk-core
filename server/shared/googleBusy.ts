export async function googleBusy(platform,from,to,transport=fetch){
 const rows=await platform.asServiceRole.entities.CalendarConnection.filter({active:true,blocks_availability:true},"id",51);
 const ids=[...new Set(rows.filter(c=>!c.provider || c.provider==="google").map(c=>c.calendar_id))];
 if(rows.length>50 || ids.some(id=>!id))throw Error("google_availability_unavailable");
 if(!ids.length)return [];
 const {accessToken}=await platform.asServiceRole.connectors.getConnection("googlecalendar");
 const response=await transport("https://www.googleapis.com/calendar/v3/freeBusy",{method:"POST",headers:{Authorization:"Bearer "+accessToken,"Content-Type":"application/json"},body:JSON.stringify({timeMin:from,timeMax:to,items:ids.map(id=>({id}))}),signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error("google_availability_unavailable");
 const data=await response.json(),busy=[];
 for(const id of ids){
  const calendar=data.calendars?.[id];
  if(!calendar || calendar.errors?.length || !Array.isArray(calendar.busy))throw Error("google_availability_unavailable");
  for(const period of calendar.busy){
   if(!Number.isFinite(Date.parse(period.start)) || !Number.isFinite(Date.parse(period.end)) || Date.parse(period.end)<=Date.parse(period.start))throw Error("google_availability_unavailable");
   busy.push({start:period.start,end:period.end});
  }
 }
 return busy;
}
