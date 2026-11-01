const test=require("node:test"),assert=require("node:assert/strict"),esbuild=require("./helpers.cjs");
test("integration status is admin-only and never returns provider credentials",async()=>{
 const result=await esbuild.build({entryPoints:["server/functions/adminIntegrationStatus/entry.ts"],bundle:true,write:false,platform:"node",format:"esm",plugins:[{name:"sdk",setup(build){
  build.onResolve({filter:/context\.ts$/},()=>({path:"sdk",namespace:"mock"}));
  build.onLoad({filter:/.*/,namespace:"mock"},()=>({contents:"export const createClientFromRequest=()=>globalThis.statusClient;",loader:"js"}));
 }}]});
 const handler=(await import("data:text/javascript;base64,"+Buffer.from(result.outputFiles[0].text).toString("base64"))).default;
 let role="user",secrets={},reads=0,authorized=false;
 global.testEnvironment={env:{get:key=>{reads++;return secrets[key];}}};
 global.statusClient={auth:{me:async()=>({role})},asServiceRole:{entities:{Setting:{filter:async()=>[{value:"https://booking.example.test"}]}},connectors:{getConnection:async()=>{if(!authorized)throw Error("not connected");return {accessToken:"TEST-OAUTH-CREDENTIAL"};}}}};
 const call=()=>handler(new Request("https://test.example",{method:"POST",body:"{}"}));
 let response=await call();assert.equal(response.status,403);assert.equal(reads,0);
 role="admin";response=await call();let data=await response.json();
 assert.equal(data.google.authorized,false);assert.equal(data.resend.configured,false);
 secrets={RESEND_API_KEY:"TEST-SERVER-CREDENTIAL",RESEND_FROM:"Demo <booking@example.test>"};authorized=true;
 response=await call();data=await response.json();
 assert.equal(data.resend.configured,true);assert.equal(data.google.authorized,true);assert.equal(data.resend.domain_verified,null);
 assert(!JSON.stringify(data).includes("TEST-SERVER-CREDENTIAL"));assert(!JSON.stringify(data).includes("TEST-OAUTH-CREDENTIAL"));
 secrets.RESEND_FROM="invalid";response=await call();data=await response.json();assert.equal(data.resend.configured,false);
});
