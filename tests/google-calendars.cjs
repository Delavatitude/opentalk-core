const assert=require("node:assert/strict"),esbuild=require("./helpers.cjs");
(async()=>{
 const build=await esbuild.build({entryPoints:["server/shared/googleCalendars.ts"],bundle:true,write:false,platform:"node",format:"esm"});
 const {syncGoogleCalendars,googleEventId,googleBusyForReschedule,googleReferences}=await import("data:text/javascript;base64,"+Buffer.from(build.outputFiles[0].text).toString("base64"));
 let b={id:"booking-a",name:"Guest",email:"guest@example.test",booking_type_name:"Standard",context:"general",status:"confirmed",start_at:"2026-09-10T10:00:00Z",end_at:"2026-09-10T10:30:00Z",notify_email:true,location_type:"google_meet",google_calendar_events:[]};
 const calendars=[{calendar_id:"first",provider:"google"},{calendar_id:"second",provider:"google"},{calendar_id:"first",provider:"google"},{calendar_id:"wix",provider:"wix"}];
 const entity={get:async()=>structuredClone(b),update:async(id,p)=>{Object.assign(b,structuredClone(p));return structuredClone(b);}};
 const base={asServiceRole:{entities:{Booking:entity,CalendarConnection:{filter:async()=>calendars}},connectors:{getConnection:async()=>({accessToken:"fake"})}}};
 const events=new Map(),calls=[];let failSecond=true;
 const transport=async(url,opts)=>{
  const u=new URL(url),parts=u.pathname.split("/"),calendar=decodeURIComponent(parts[4]),id=parts[6],body=opts.body?JSON.parse(opts.body):{};
  calls.push({calendar,method:opts.method,body,notify:u.searchParams.get("sendUpdates")});
  if(calendar==="second" && failSecond)return {ok:false,status:403};
  const key=calendar+"/"+(id || body.id);
  if(opts.method==="GET")return events.has(key)?{ok:true,status:200,json:async()=>structuredClone(events.get(key))}:{ok:false,status:404};
  if(opts.method==="POST"){
   if(events.has(key))return {ok:false,status:409};
   const e={...body,status:"confirmed",...(calendar==="first"?{hangoutLink:"https://meet.google.com/test"}:{})};events.set(key,e);return {ok:true,status:200,json:async()=>structuredClone(e)};
  }
  if(opts.method==="PATCH"){Object.assign(events.get(key),body);return {ok:true,status:200,json:async()=>structuredClone(events.get(key))};}
  events.delete(key);return {ok:true,status:204};
 };
 assert.equal(googleReferences({google_calendar_events:[],calendar_event_id:"legacy",calendar_id:"first"})[0].event_id,"legacy");
 assert.match(await googleEventId(b.id),/^[a-v0-9]{5,1024}$/);
 assert.equal((await syncGoogleCalendars(base,b.id,transport)).status,"partial");
 assert.equal(events.size,1);assert.equal(b.google_calendar_events.length,2);
 failSecond=false;assert.equal((await syncGoogleCalendars(base,b.id,transport)).status,"synced");assert.equal(events.size,2);
 assert.equal(calls.filter(c=>c.method==="POST" && c.calendar==="first").length,1);
 const posts=calls.filter(c=>c.method==="POST");assert.equal(posts[0].body.attendees.length,1);assert.equal(posts.at(-1).body.attendees.length,0);assert.equal(posts.at(-1).notify,"none");assert.equal(posts.at(-1).body.location,"https://meet.google.com/test");assert.equal(posts.at(-1).body.conferenceData,undefined);
 b.start_at="2026-09-10T11:00:00Z";b.end_at="2026-09-10T11:30:00Z";
 await syncGoogleCalendars(base,b.id,transport);for(const e of events.values())assert.equal(e.start.dateTime,b.start_at);
 calendars.length=0; b.status="cancelled";
 await syncGoogleCalendars(base,b.id,transport);assert.equal(events.size,0);assert.equal(b.calendar_sync_status,"synced");
 calendars.push({calendar_id:"first",provider:"google"});
 const own=b.google_calendar_events.find(r=>r.calendar_id==="first").event_id;
 global.fetch=async()=>({ok:true,json:async()=>({timeZone:"UTC",items:[{id:own,start:{dateTime:b.start_at},end:{dateTime:b.end_at}},{id:"someone-else",start:{dateTime:b.start_at},end:{dateTime:b.end_at}},{id:"free",transparency:"transparent"}]})});
 const busy=await googleBusyForReschedule(base,b,b.start_at,b.end_at);
 assert.equal(busy.length,1,"Exclude only our copy, preserving overlapping appointments");
 console.log("PASS Google: both targets; deduplication; partial failure; safe retry; one invitation and Meet; reschedule and cancellation after configuration removal. Mocked Google API.");
})().catch(e=>{console.error(e);process.exit(1)});
