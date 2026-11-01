const assert=require("node:assert/strict"),esbuild=require("./helpers.cjs");
(async()=>{
 const built=await esbuild.build({entryPoints:["server/shared/wixCalendar.ts"],bundle:true,write:false,platform:"node",format:"esm"});
 const {syncWixBooking,wixKey,wixBusy,WIX_SCHEDULE_ID}=await import("data:text/javascript;base64,"+Buffer.from(built.outputFiles[0].text).toString("base64"));
 let b={id:"booking-test",name:"Test",booking_type_name:"Standard",start_at:"2026-09-08T08:00:00.000Z",end_at:"2026-09-08T08:30:00.000Z",status:"confirmed"};
 let event,creates=0,patches=0,cancels=0,loseResponse=true;
 const entity={get:async()=>({...b}),update:async(id,p)=>{Object.assign(b,p);return {...b};}};
 const client={asServiceRole:{entities:{Booking:entity}}};
 const remote=async(path,method="GET",body)=>{
   if(method==="GET")return {event:structuredClone(event)};
   if(path.endsWith("/cancel")){cancels++;event.status="CANCELLED";return {event:structuredClone(event)};}
   if(method==="POST"){
    if(!event){creates++;event={...body.event,id:"wix-event",revision:"1",status:"CONFIRMED",start:{utcDate:b.start_at},end:{utcDate:b.end_at}};}
    if(loseResponse){loseResponse=false;throw Error("timeout");}return {event:structuredClone(event)};
   }
   patches++;event={...event,...body.event,start:{utcDate:body.event.start.localDate+"Z"},end:{utcDate:body.event.end.localDate+"Z"},revision:"2"};return {event:structuredClone(event)};
 };
 assert.equal((await syncWixBooking(client,b.id,remote)).success,false);assert.equal(b.wix_sync_status,"failed");
 assert.equal((await syncWixBooking(client,b.id,remote)).success,true);assert.equal(creates,1,"ambiguous create retry must reuse the same event");
 await syncWixBooking(client,b.id,remote);assert.equal(creates,1);assert.equal(patches,0,"ISO precision difference must not rewrite event");
 b.start_at="2026-09-08T09:00:00.000Z";b.end_at="2026-09-08T09:30:00.000Z";
 await syncWixBooking(client,b.id,remote);assert.equal(patches,1);assert.equal(Date.parse(event.start.utcDate),Date.parse(b.start_at));
 b.status="cancelled";await syncWixBooking(client,b.id,remote);await syncWixBooking(client,b.id,remote);assert.equal(cancels,1);
 assert.equal(await wixKey("a"),await wixKey("a"));assert.notEqual(await wixKey("a"),await wixKey("b"));
 let calendarPage=0,externalUrl="";
 const busy=await wixBusy({},b.start_at,b.end_at,"own",async(path,method,body)=>{
  if(method==="POST"){
   calendarPage++;
   if(calendarPage===1)return {events:[{id:"own",scheduleId:WIX_SCHEDULE_ID,start:{utcDate:b.start_at},end:{utcDate:b.end_at}},{id:"free",scheduleId:WIX_SCHEDULE_ID,transparency:"TRANSPARENT"},{id:"cancelled",scheduleId:WIX_SCHEDULE_ID,status:"CANCELLED"}],pagingMetadata:{hasNext:true,cursors:{next:"page2"}}};
   assert.equal(body.query.cursorPaging.cursor,"page2");
   return {events:[{id:"other",scheduleId:WIX_SCHEDULE_ID,start:{utcDate:b.start_at},end:{utcDate:b.end_at}}],pagingMetadata:{hasNext:false}};
  }
  externalUrl=path;
  return {events:[{start:"2026-09-01T00:00:00Z",end:"2026-09-10T00:00:00Z",allDay:true}],pagingMetadata:{hasNext:false}};
 });
 assert.equal(busy.length,2);assert.equal(calendarPage,2);
 assert.equal(new URL("https://example.test"+externalUrl).searchParams.has("scheduleIds"),false,"external Apple/iOS lookup must cover every Wix connection");
 await assert.rejects(()=>wixBusy({},b.start_at,b.end_at,"",async()=>({events:[],failedProviderIds:["apple"]})),/wix_sync_failed/);
 console.log("PASS Wix: idempotent retry after timeout; date updates; cancellation; pagination; transparent/cancelled/own exclusions; Apple all-day blocking; fail closed on incomplete external data. Mocked provider.");
})().catch(e=>{console.error(e);process.exit(1);});
