const assert=require("node:assert/strict"),esbuild=require("./helpers.cjs");
(async()=>{
 const r=await esbuild.build({entryPoints:["server/shared/smsPartner.ts"],bundle:true,write:false,platform:"node",format:"esm"});
 const {sendBookingSms,normalizeSmsPhone}=await import("data:text/javascript;base64,"+Buffer.from(r.outputFiles[0].text).toString("base64"));
 assert.equal(normalizeSmsPhone("06 12 34 56 78"),"+33612345678");
 assert.equal(normalizeSmsPhone("+44 7700 900123"),"+447700900123");
 assert.equal(normalizeSmsPhone("wrong"),null);
 let configured=false,calls=0,mode="ok",row;
 const original={id:"test",notify_sms:true,sms_status:"pending",status:"confirmed",phone:"0612345678",start_at:"2026-12-10T12:00:00Z",locale:"fr",timezone:"Europe/Paris"};
 const api={asServiceRole:{entities:{Booking:{get:async()=>row,update:async(id,data)=>Object.assign(row,data)}}}};
 global.testEnvironment={env:{get:k=>k==="SMS_PARTNER_API_KEY"&&configured?"mock-only":undefined}};
 global.fetch=async(url,options)=>{
  calls++;assert.equal(url,"https://api.smspartner.fr/v1/send");
  const body=JSON.parse(options.body);assert.equal(body.phoneNumbers,"+33612345678");assert.equal(body.sender,"OPENTALK");assert.ok(body.message.includes("13:00"));
  if(mode==="timeout")throw Error("mock-only");
  return {ok:true,json:async()=>({success:true,message_id:123})};
 };
 row={...original};await sendBookingSms(api,row);assert.equal(calls,0);assert.equal(row.sms_status,"pending_configuration");
 configured=true;await sendBookingSms(api,row);assert.equal(calls,1);assert.equal(row.sms_status,"accepted");assert.equal(row.sms_provider_message_id,"123");assert.ok(!JSON.stringify(row).includes("mock-only"));
 await sendBookingSms(api,row);assert.equal(calls,1);
 row={...original,notify_sms:false};await sendBookingSms(api,row);assert.equal(calls,1);
 row={...original};mode="timeout";await sendBookingSms(api,row);assert.equal(row.sms_status,"review_required");await sendBookingSms(api,row);assert.equal(calls,2);assert.equal(row.status,"confirmed");
 console.log("PASS SMS Partner: phone validation, missing key, opt-out, accepted ID, no repeat, uncertain send blocked, booking preserved. Network mocked.");
})().catch(e=>{console.error(e);process.exit(1)});
