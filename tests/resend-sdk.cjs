const assert=require("node:assert/strict"),esbuild=require("./helpers.cjs"),Module=require("node:module");
(async()=>{
let logs=[],requests=0,configured=false,role="admin",fail=false;
global.testEnvironment={env:{get:k=>k==="RESEND_API_KEY" && configured ? "test-placeholder-credential" : k==="BOOKING_TEST_EMAIL_TO" ? "test@example.test" : k==="BOOKING_TEST_EMAIL_FROM" ? "onboarding@resend.dev" : undefined}};
const r=await esbuild.build({entryPoints:["server/functions/sendTestEmail/entry.ts"],bundle:true,write:false,platform:"node",format:"cjs",plugins:[{name:"runtime",setup(b){
 b.onResolve({filter:/^npm:resend/},()=>({path:require.resolve("resend")}));
 b.onResolve({filter:/context\.ts$/},()=>({path:"sdk",namespace:"mock"}));
 b.onLoad({filter:/.*/,namespace:"mock"},()=>({contents:"export const createClientFromRequest=()=>globalThis.testApi;",loader:"js"}));
}}]});
const m=new Module("resend-test.cjs",module);m.paths=module.paths;m._compile(r.outputFiles[0].text,"resend-test.cjs");const handler=m.exports.default;
global.testApi={auth:{me:async()=>({role})},asServiceRole:{entities:{EmailLog:{
filter:async q=>logs.filter(l=>l.dedupe_key===q.dedupe_key),
create:async d=>{const row={...d,id:"log-"+logs.length};logs.push(row);return {...row};},
update:async(id,d)=>{const row=logs.find(l=>l.id===id);Object.assign(row,d);return {...row};}
}}}};
global.fetch=async(url,options)=>{
requests++;assert.equal(url,"https://api.resend.com/emails");
const body=JSON.parse(options.body);assert.equal(body.from,"onboarding@resend.dev");assert.deepEqual(body.to,["test@example.test"]);assert.equal(body.subject,"Hello World");
return Response.json(fail?{name:"validation_error",message:"Never expose test-placeholder-credential"}:{id:"provider-123"},{status:fail?422:200});
};
const invoke=()=>handler(new Request("https://test",{method:"POST",body:JSON.stringify({to:"other@example.test",from:"other@example.test"})}));
role="user";assert.equal((await invoke()).status,403);assert.equal(requests,0);
role="admin";let result=await (await invoke()).json();assert.equal(result.error,"email_secret_missing");assert.equal(logs[0].status,"pending_configuration");
configured=true;result=await (await invoke()).json();assert.equal(result.success,true);assert.equal(result.provider_message_id,"provider-123");assert.equal(logs[0].provider_message_id,"provider-123");assert.equal(requests,1);
await invoke();assert.equal(requests,1);
logs=[];fail=true;result=await (await invoke()).json();assert.equal(result.success,false);assert.equal(result.error,"resend_validation_error");assert.equal(logs[0].status,"failed");
assert.ok(!JSON.stringify(logs).includes("test-placeholder-credential"));assert.ok(!JSON.stringify(result).includes("test-placeholder-credential"));
logs[0].first_attempt_at=new Date(Date.now()-24*3600000).toISOString();const before=requests;result=await (await invoke()).json();assert.equal(result.status,"review_required");assert.equal(requests,before);
console.log("PASS: official Resend SDK; fixed test recipient/sender; admin-only; named backend secret; explicit data/error; provider ID persisted; duplicate clicks suppressed; safe errors; no credential in results/logs; expired retry blocked. Network mocked.");
})().catch(e=>{console.error(e);process.exit(1)});
