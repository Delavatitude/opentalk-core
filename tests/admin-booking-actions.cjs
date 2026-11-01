const fs=require("fs"),vm=require("vm"),assert=require("assert/strict");
const source=fs.readFileSync("server/functions/adminBookingActions/entry.ts","utf8").replace(/^import .*;\n/gm,"").replace("export default async function(req)","async function handler(req)");
function harness(role="admin"){
 let b={id:"b",status:"confirmed",start_at:"2026-09-10T09:00:00.000Z",end_at:"2026-09-10T09:30:00.000Z",booking_type_id:"t",reschedule_token:"secret",cancel_token:"secret2",notify_email:true,phone:"+33612345678",contact_id:"c"};
 const calls=[],state={slots:[{start_at:"2026-09-11T09:00:00.000Z",end_at:"2026-09-11T09:30:00.000Z"}],fail:false};
 const db={Booking:{get:async()=>({...b}),filter:async()=>[b],update:async(id,p)=>{calls.push(["update",p]);b={...b,...p};return b;},delete:async()=>{calls.push(["delete"]);b=null;}},BookingType:{get:async()=>({id:"t",active:true,duration:30}),filter:async()=>[]},Setting:{filter:async()=>[]},AvailabilityRule:{filter:async()=>[]},BlockedPeriod:{filter:async()=>[]}};
 const ctx={Response,Date,URL,crypto:require("crypto").webcrypto,fetch:()=>{throw Error("real network forbidden");},createClientFromRequest:()=>({auth:{me:async()=>({role})},asServiceRole:{entities:db}}),
 syncGoogleCalendars:async(...args)=>{calls.push(["google",args[3]]);return {status:state.fail?"failed":"synced"};},syncWixBooking:async()=>{calls.push(["wix"]);return {status:"synced"};},
 googleBusyForReschedule:async()=>[],wixBusy:async()=>[],computeAvailability:async()=>state.slots,zonedDate:s=>s.slice(0,10),safeNotify:async(...a)=>calls.push(["email",a[2],a[4]]),sendAdminBookingSms:async(...a)=>calls.push(["sms",a[2]]),normalizeSmsPhone:p=>p?.startsWith("+")?p:null,refreshContact:async()=>calls.push(["refresh"])};
 vm.createContext(ctx);vm.runInContext(source+";this.handler=handler;",ctx);
 return {calls,state,get booking(){return b;},run:async body=>{const r=await ctx.handler({url:"https://example.com/admin",json:async()=>({booking_id:"b",...body})});return {status:r.status,data:await r.json()};}};
}
(async()=>{
 let h=harness("user");assert.equal((await h.run({action:"delete"})).status,403);assert.equal(h.calls.length,0);
 h=harness();await h.run({action:"slots",date:"2026-09-11"});assert.equal(h.calls.length,0);
 const move={action:"move",expected_start_at:"2026-09-10T09:00:00.000Z",new_start_at:"2026-09-11T09:00:00.000Z",new_end_at:"2026-09-11T09:30:00.000Z",sync_calendars:false,notify_email:false,notify_sms:false};
 assert.equal((await h.run(move)).data.ok,true);assert(!h.calls.some(c=>["google","wix","email","sms"].includes(c[0])));assert.equal(h.booking.notify_email,true);
 h=harness();await h.run({...move,sync_calendars:true,notify_email:true,notify_sms:true});for(const k of ["google","wix","email","sms"])assert(h.calls.some(c=>c[0]===k));
 h=harness();h.state.slots=[];assert.equal((await h.run(move)).data.ok,true);assert(h.calls.some(c=>c[0]==="update"));
 h=harness();assert.equal((await h.run({...move,expected_start_at:"stale"})).status,409);assert.equal(h.calls.length,0);
 h=harness();h.state.fail=true;assert.equal((await h.run({action:"delete",notify_email:true,notify_sms:true})).data.ok,false);assert(h.booking.deletion_pending);assert.equal(h.booking.reschedule_token,"");assert(!h.calls.some(c=>c[0]==="delete"));h.state.fail=false;assert.equal((await h.run({action:"delete",notify_email:true,notify_sms:true})).data.deleted,true);assert.equal(h.booking,null);assert.equal(h.calls.filter(c=>c[0]==="email").length,1);assert.equal(h.calls.filter(c=>c[0]==="sms").length,1);
 console.log("PASS: admin authorization, read-only slots, per-action options, unchanged notification preferences, administrator override and stale rejection, external cleanup failure and retry, revoked client links, single cancellation notification. No live changes or messages.");
})().catch(e=>{console.error(e);process.exitCode=1;});
