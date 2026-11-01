const assert=require("node:assert/strict"),esbuild=require("./helpers.cjs"),{parsePhoneNumberFromString}=require("libphonenumber-js");
(async()=>{
const r=await esbuild.build({entryPoints:["server/shared/phone.ts"],bundle:true,write:false,format:"esm",platform:"node",plugins:[{name:"npm",setup(b){b.onResolve({filter:/^libphonenumber-js$/},()=>({path:require.resolve("libphonenumber-js")}));}}]});
const {phoneProfile}=await import("data:text/javascript;base64,"+Buffer.from(r.outputFiles[0].text).toString("base64"));
assert.equal(parsePhoneNumberFromString("0612345678","FR").number,"+33612345678");
assert.equal(parsePhoneNumberFromString("2025550123","US").number,"+12025550123");
assert.deepEqual(phoneProfile("+33 6 12 34 56 78"),{phone:"+33612345678",phone_country:"FR",phone_calling_code:"+33"});
assert.equal(phoneProfile("+1 202 555 0123").phone_calling_code,"+1");
assert.equal(phoneProfile("0033612345678").phone,"+33612345678");
assert.equal(phoneProfile("0612345678").phone_calling_code,"");
assert.equal(phoneProfile("").phone,"");
console.log("PASS phone: FR/US, international prefix, national conversion, legacy preservation.");
})().catch(e=>{console.error(e);process.exit(1)});
