const fs=require("fs"),vm=require("vm"),assert=require("assert/strict");
const ctx={AbortSignal,Date};vm.createContext(ctx);vm.runInContext(fs.readFileSync("server/shared/googleBusy.ts","utf8").replace("export ",""),ctx);
const client={asServiceRole:{entities:{CalendarConnection:{filter:async()=>[{provider:"google",calendar_id:"a"},{provider:"google",calendar_id:"b"}]}},connectors:{getConnection:async()=>({accessToken:"fake"})}}};
const response=data=>async()=>({ok:true,json:async()=>data});
(async()=>{
 const busy={start:"2026-09-14T08:00:00Z",end:"2026-09-14T12:00:00Z"};
 assert.equal((await ctx.googleBusy(client,busy.start,busy.end,response({calendars:{a:{busy:[busy]},b:{busy:[]}}}))).length,1);
 for(const data of [{calendars:{a:{busy:[]},b:{errors:[{reason:"notFound"}]}}},{calendars:{a:{busy:[]}}},{calendars:{a:{busy:[{start:"invalid",end:"invalid"}]},b:{busy:[]}}}]){
  await assert.rejects(()=>ctx.googleBusy(client,busy.start,busy.end,response(data)),/unavailable/);
 }
 await assert.rejects(()=>ctx.googleBusy(client,busy.start,busy.end,async()=>({ok:false,status:403})),/unavailable/);
 await assert.rejects(()=>ctx.googleBusy(client,busy.start,busy.end,async()=>{throw Error("timeout");}));
 console.log("PASS: Google busy ranges, per-calendar errors, missing calendar, malformed dates, HTTP failure and timeout reject availability. No live writes.");
})().catch(e=>{console.error(e);process.exitCode=1;});
