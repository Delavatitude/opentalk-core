const assert = require("node:assert/strict");
const esbuild = require("./helpers.cjs");
async function moduleFrom(path) {
  const { outputFiles } = await esbuild.build({ entryPoints:[path],bundle:true,write:false,platform:"node",format:"esm" });
  return import("data:text/javascript;base64," + Buffer.from(outputFiles[0].text).toString("base64"));
}
(async () => {
  const { notificationTemplate } = await moduleFrom("server/shared/notificationTemplates.ts");
  const { notifyBooking, reminderDue, reminderEnabled, safeNotify } = await moduleFrom("server/shared/notifications.ts");
  const { contextsFor } = await moduleFrom("src/lib/bookingContexts.js");
  const now = Date.now();
  const b = {id:"test-booking",name:'Camille <script>',email:"guest@example.test",booking_type_id:"type",booking_type_name:"Échange Project A",context:"project-a",locale:"fr",timezone:"Asia/Ho_Chi_Minh",start_at:new Date(now+24*3600000).toISOString(),end_at:new Date(now+24.5*3600000).toISOString(),duration:30,status:"confirmed",created_date:new Date(now-86400000).toISOString(),notification_revision:new Date(now-86400000).toISOString()+"|rev",reschedule_token:"manage",cancel_token:"cancel"};
  for (const locale of ["fr","en"]) for(const kind of ["confirmation","rescheduled","cancelled","reminder_24h","reminder_1h"]) {
    const mail=notificationTemplate({...b,locale},kind,"https://booking.example.test");
    assert.ok(mail.html.includes('lang="'+locale+'"'));
    assert.ok(mail.html.includes("PROJECT-A")); assert.ok(mail.text.includes("Asia/Ho_Chi_Minh"));
    assert.ok(!mail.html.includes("<script>")); assert.ok(mail.html.includes("&lt;script&gt;"));
    if(kind!=="cancelled") assert.ok(mail.html.includes("?lang="+locale));
    assert.ok(mail.subject.length>10);
  }
  const fr=notificationTemplate({...b,start_at:"2026-09-07T09:00:00Z",end_at:"2026-09-07T09:30:00Z"},"confirmation","https://booking.example.test");
  assert.ok(fr.text.includes("16:00")); assert.ok(fr.text.includes("septembre")); assert.ok(fr.subject.includes("confirmé"));
  assert.equal(reminderDue(b,24,now),true);
  assert.equal(reminderDue({...b,status:"rescheduled"},24,now),true);
  assert.equal(reminderDue({...b,status:"cancelled"},24,now),false);
  assert.equal(reminderDue({...b,start_at:new Date(now-1).toISOString()},1,now),false);
  assert.equal(reminderDue({...b,notification_revision:new Date(now+1).toISOString()+"|new"},24,now),false);
  assert.equal(reminderDue(b,1,now),false);
  assert.equal(reminderEnabled({reminder_24h:"off"},[],"reminder_24h"),false);
  assert.equal(reminderEnabled({reminder_24h:"on"},[{key:"reminder_24h",value:"false"}],"reminder_24h"),true);
  assert.equal(reminderEnabled({},[{key:"reminder_24h",value:"false"}],"reminder_24h"),false);
  assert.deepEqual(contextsFor({slug:"quick-call"}),["general"]);
  assert.deepEqual(contextsFor({slug:"strategy"}),["general"]);
  assert.deepEqual(contextsFor({slug:"anything",contexts:["project-a","project-c"]}),["project-a","project-c"]);
  let logs=[],current={...b},calls=0,mode="ok",configured=true,type={};
  global.testEnvironment={env:{get:k=>configured ? (k==="RESEND_API_KEY"?"fake-test-only":"OpenTalk <booking@example.test>") : undefined}};
  global.fetch=async (_url,opts)=>{calls++; assert.ok(opts.headers["Idempotency-Key"]); if(mode==="network") throw new Error("mock timeout"); return {ok:mode==="ok",status:mode==="ok"?200:503,json:async()=>mode==="ok"?{id:"mock-provider-id"}:{name:"unavailable"}};};
  const db={EmailLog:{filter:async q=>logs.filter(l=>l.dedupe_key===q.dedupe_key),create:async data=>{const l={...data,id:String(logs.length)};logs.push(l);return l},update:async(id,data)=>{const l=logs.find(l=>l.id===id);Object.assign(l,data);return l}},Booking:{get:async()=>current},BookingType:{get:async()=>type}};
  const api={asServiceRole:{entities:db}},settings=[{key:"app_base_url",value:"https://booking.example.test"}];
  configured=false;await notifyBooking(api,b,"confirmation",settings);assert.equal(calls,0);assert.equal(logs[0].status,"pending_configuration");
  configured=true;await notifyBooking(api,b,"confirmation",settings);await notifyBooking(api,b,"confirmation",settings);assert.equal(calls,1);assert.equal(logs[0].status,"sent");
  logs=[];mode="network";await notifyBooking(api,b,"confirmation",settings);assert.equal(logs[0].status,"failed");assert.equal(current.status,"confirmed");
  const payload=logs[0].payload_json;mode="ok";await notifyBooking(api,b,"confirmation",settings);assert.equal(logs[0].status,"sent");assert.equal(logs[0].payload_json,payload);
  logs=[];mode="network";await notifyBooking(api,b,"confirmation",settings);logs[0].first_attempt_at=new Date(now-24*3600000).toISOString();const count=calls;await notifyBooking(api,b,"confirmation",settings);assert.equal(calls,count);assert.equal(logs[0].status,"review_required");
  logs=[];current={...b,status:"cancelled"};await notifyBooking(api,b,"reminder_24h",settings);assert.equal(logs[0].status,"skipped");assert.equal(calls,count);
  logs=[];current={...b,notification_revision:"new-revision"};await notifyBooking(api,b,"reminder_24h",settings);assert.equal(logs[0].status,"skipped");
  logs=[];current={...b};type={reminder_24h:"off"};await notifyBooking(api,b,"reminder_24h",settings);assert.equal(logs[0].status,"skipped");
  logs=[];current={...b,notify_email:false};const beforeDisabled=calls;for(const kind of ["confirmation","rescheduled","cancelled","reminder_24h","reminder_1h"]) await notifyBooking(api,current,kind,settings);assert.equal(calls,beforeDisabled);assert.ok(logs.every(l=>l.status==="skipped"));
  const before=console.error;console.error=()=>{};await safeNotify({asServiceRole:{entities:{}}},b,"confirmation",settings);console.error=before;
  console.log("PASS: 10 locale/template combinations; guest timezone; HTML escaping; reminder boundaries; context rules; configuration; deduplication; provider failure/retry; expired idempotency; cancelled/rescheduled/disabled reminders; booking survives logging failure. No real email sent.");
})().catch(e=>{console.error(e);process.exit(1)});
