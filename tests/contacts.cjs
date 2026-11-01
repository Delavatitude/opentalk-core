const assert=require("node:assert/strict"),esbuild=require("./helpers.cjs");
async function mod(path,mock=false){const r=await esbuild.build({entryPoints:[path],bundle:true,write:false,platform:"node",format:"esm",plugins:mock?[{name:"mock-sdk",setup(b){b.onResolve({filter:/^libphonenumber-js$/},()=>({path:require.resolve("libphonenumber-js")}));b.onResolve({filter:/context\.ts$/},()=>({path:"sdk",namespace:"mock"}));b.onLoad({filter:/.*/,namespace:"mock"},()=>({contents:"export const createClientFromRequest = () => globalThis.testClient;",loader:"js"}));}}]:[{name:"phone",setup(b){b.onResolve({filter:/^libphonenumber-js$/},()=>({path:require.resolve("libphonenumber-js")}));}}]});return import("data:text/javascript;base64,"+Buffer.from(r.outputFiles[0].text).toString("base64"));}
function database(){
 const rows={Contact:[],Booking:[],BookingLink:[],BookingType:[],Setting:[]};let seq=0;
 const matches=(row,q)=>Object.entries(q).every(([k,v])=>row[k]===v);
 const db={};for(const name of Object.keys(rows))db[name]={
  filter:async(q={},sort,limit=100,skip=0)=>rows[name].filter(r=>matches(r,q)).slice(skip,skip+limit).map(r=>({...r})),
  get:async id=>{const r=rows[name].find(r=>r.id===id);if(!r)throw new Error("missing");return {...r};},
  create:async data=>{const r={...data,id:name+(++seq),created_date:new Date().toISOString()};rows[name].push(r);return {...r};},
  update:async(id,patch)=>{const r=rows[name].find(r=>r.id===id);Object.assign(r,patch);return {...r};},
  updateMany:async(q,patch)=>{let updated=0;for(const r of rows[name].filter(r=>matches(r,q))){Object.assign(r,patch.$set);updated++;}return {updated};}
 };return {db,rows};
}
(async()=>{
 const {normalizeEmail,upsertContact,attachBookingContact,refreshContact}=await mod("server/shared/contacts.ts");
 const {publicLink,linkUsable}=await mod("server/shared/bookingLinks.ts");
 const {crmSearch}=await mod("src/lib/crm.js");
 const {db,rows}=database();
 assert.equal(normalizeEmail(" JOHN@Example.com "),"john@example.com");
 const c=await upsertContact(db,{name:"Élise Example",email:" JOHN@Example.com ",phone:"+33 6 12 34 56 78",company:"Example Studio",locale:"fr",timezone:"Asia/Ho_Chi_Minh",notes:"Private",tags:["client"]},{manual:true});
 assert.equal(c.first_name,"Élise");assert.equal(c.last_name,"Example");
 assert.ok(crmSearch(c,"Elise"));assert.ok(crmSearch(c,"Example Studio"));assert.ok(crmSearch(c,"0612")===false);assert.ok(crmSearch(c,"3361234"));assert.ok(crmSearch(c,"john@EXAMPLE.com"));
 let b=await db.Booking.create({name:"Élise Example",email:"john@example.com",phone:"",company:"",locale:"fr",timezone:"Asia/Ho_Chi_Minh",start_at:"2026-10-01T09:00:00Z",status:"confirmed",context:"project-a",booking_type_name:"Partnership"});
 await attachBookingContact(db,b);await attachBookingContact(db,b);
 assert.equal(rows.Contact.filter(c=>!c.merged_into).length,1);assert.equal(rows.Contact[0].total_bookings,1);assert.equal(rows.Contact[0].notes,"Private");assert.equal(rows.Contact[0].phone,"+33612345678");assert.equal(rows.Contact[0].phone_calling_code,"+33");assert.equal(rows.Contact[0].phone_country,"FR");assert.equal(rows.Booking[0].contact_id,c.id);
 const b2=await db.Booking.create({...b,id:undefined,email:"JOHN@example.com",start_at:"2026-11-01T09:00:00Z",status:"cancelled",context:"project-c",booking_type_name:"Website"});
 await attachBookingContact(db,b2);assert.equal(rows.Contact[0].total_bookings,2);assert.ok(rows.Contact[0].contexts.includes("project-c"));
 await db.Booking.update(b.id,{start_at:"2026-12-01T09:00:00Z",status:"rescheduled"});await refreshContact(db,c.id);assert.equal(rows.Contact[0].last_booking_at,"2026-12-01T09:00:00Z");assert.equal(rows.Contact[0].total_bookings,2);
 await db.Contact.create({...c,id:undefined,notes:"Other note"});await upsertContact(db,{...c,email:"john@example.com"});assert.equal(rows.Contact.filter(c=>!c.merged_into).length,1);assert.ok(rows.Contact[0].notes.includes("Other note"));
 const race=database();await Promise.all([upsertContact(race.db,{name:"Jane",email:"jane@example.com"}),upsertContact(race.db,{name:"Jane",email:"JANE@example.com"})]);assert.equal(race.rows.Contact.filter(c=>!c.merged_into).length,1);
 const safe=publicLink({id:"link",slug:"opaque",contact_id:"SECRET-ID",notes:"PRIVATE",invitation_payload:"PRIVATE",contact_name:"John",contact_email:"john@example.com"});
 assert.equal(safe.contact_id,undefined);assert.equal(safe.notes,undefined);assert.equal(safe.invitation_payload,undefined);assert.equal(safe.contact_email,"john@example.com");
 assert.equal(linkUsable({active:false}),false);assert.equal(linkUsable({active:true,valid_until:"2020-01-01"}),false);
 const handler=(await mod("server/functions/adminContacts/entry.ts",true)).default;
 global.testClient={auth:{me:async()=>({role:"user"})},asServiceRole:{entities:db}};
 let response=await handler(new Request("https://test",{method:"POST",body:'{"action":"list"}'}));assert.equal(response.status,403);
 global.testClient.auth.me=async()=>({role:"admin"});
 await db.Setting.create({key:"app_base_url",value:"https://booking.example.test"});
 const type=await db.BookingType.create({active:true,name:"Introduction",contexts:["general"]});
 response=await handler(new Request("https://test",{method:"POST",body:JSON.stringify({action:"generate_link",contact_id:c.id,booking_type_id:type.id,context:"general"})}));
 assert.equal(response.status,200);const invitation=(await response.json()).link;assert.ok(invitation.url.includes("/e/"));assert.ok(!invitation.url.includes(c.id));
 global.testEnvironment={env:{get:()=>undefined}};
 response=await handler(new Request("https://test",{method:"POST",body:JSON.stringify({action:"send_link",link_id:invitation.id})}));assert.equal((await response.json()).status,"pending_configuration");
 global.testEnvironment.env.get=k=>k==="RESEND_FROM"?"OpenTalk <test@example.test>":"test-key";
 let sends=0;global.fetch=async(url,opts)=>{sends++;assert.equal(url,"https://api.resend.com/emails");assert.ok(opts.headers["Idempotency-Key"].includes(invitation.id));assert.ok(JSON.parse(opts.body).html.includes('lang="fr"'));return {ok:true,json:async()=>({id:"mock-email"})};};
 for(let i=0;i<2;i++){response=await handler(new Request("https://test",{method:"POST",body:JSON.stringify({action:"send_link",link_id:invitation.id})}));assert.equal((await response.json()).status,"sent");}
 assert.equal(sends,1);
 console.log("PASS CRM: normalization, repeat and concurrent matching, private notes preserved, totals and reschedules, accent/phone search, private IDs hidden, expired links, admin authorization, invitation generation, missing Resend configuration, send deduplication. All email calls mocked.");
})().catch(e=>{console.error(e);process.exit(1)});
