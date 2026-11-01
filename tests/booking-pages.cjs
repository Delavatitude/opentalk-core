const assert=require("node:assert/strict"),esbuild=require("./helpers.cjs");
async function mod(path){const r=await esbuild.build({entryPoints:[path],bundle:true,write:false,platform:"node",format:"esm",plugins:[{name:"sdk",setup(b){b.onResolve({filter:/^libphonenumber-js$/},()=>({path:require.resolve("libphonenumber-js")}));b.onResolve({filter:/context\.ts$/},()=>({path:"sdk",namespace:"mock"}));b.onLoad({filter:/.*/,namespace:"mock"},()=>({contents:"export const createClientFromRequest=()=>globalThis.testClient;",loader:"js"}));}}]});return import("data:text/javascript;base64,"+Buffer.from(r.outputFiles[0].text).toString("base64"));}
function database(){const rows={BookingPage:[],Booking:[],BookingType:[],Setting:[]};let n=0;const db={};for(const name of Object.keys(rows))db[name]={filter:async(q={},sort,limit=100,skip=0)=>rows[name].filter(r=>Object.entries(q).every(([k,v])=>r[k]===v)).slice(skip,skip+limit).map(r=>({...r})),get:async id=>{const r=rows[name].find(r=>r.id===id);if(!r)throw Error("missing");return {...r};},create:async data=>{const r={...data,id:name+(++n)};rows[name].push(r);return {...r};},update:async(id,patch)=>{const r=rows[name].find(r=>r.id===id);Object.assign(r,patch);return {...r};},delete:async id=>{rows[name]=rows[name].filter(r=>r.id!==id);}};return {db,rows};}
const req=body=>new Request("https://test",{method:"POST",body:JSON.stringify(body)});
(async()=>{
const {adminPagesAction:action,findPage,pageTypes,validatePageType,cleanPage}=await mod("server/shared/bookingPages.ts");
const admin=(await mod("server/functions/adminPages/entry.ts")).default,resolve=(await mod("server/functions/resolveBookingPage/entry.ts")).default;
const {db,rows}=database();global.testClient={auth:{me:async()=>({role:"user"})},asServiceRole:{entities:db}};
assert.equal((await admin(req({action:"list"}))).status,403);
const a=await db.BookingType.create({active:true,name:"Quick",duration:15,name_fr:"Appel",buffer_before:5}),b=await db.BookingType.create({active:true,name:"Standard",duration:30});
const payload={name:"Project B",slug:"/project-b",context_key:"project-b",headline_en:"Hello",headline_fr:"Bonjour",primary_cta_en:"Confirm",primary_cta_fr:"Confirmer",booking_type_ids:[b.id,a.id],default_booking_type_id:a.id,active:true,type_overrides:[{booking_type_id:a.id,name_fr:"Votre projet",visible:true}]};
let page=(await action(db,{action:"save",page:payload})).page;
assert.equal(page.slug,"project-b");assert.equal(page.status,"draft");assert.equal(await findPage(db,{slug:"project-b"}),null);
assert.equal((await resolve(req({slug:"project-b"}))).status,404);
assert.equal((await resolve(req({preview_id:page.id}))).status,403);
global.testClient.auth.me=async()=>({role:"admin"});
let preview=await resolve(req({preview_id:page.id}));assert.equal(preview.status,200);assert.equal((await preview.json()).page.headline_fr,"Bonjour");
page=(await action(db,{action:"publish",id:page.id,page})).page;
let live=await findPage(db,{slug:"project-b"});assert.equal(live.headline_fr,"Bonjour");assert.deepEqual(pageTypes(live,[a,b]).map(t=>t.id),[b.id,a.id]);assert.equal(pageTypes(live,[a,b])[1].name_fr,"Votre projet");assert.equal(pageTypes(live,[a,b])[1].duration,15);assert.equal(pageTypes(live,[a,b])[1].buffer_before,undefined);
await action(db,{action:"save",id:page.id,page:{...page,headline_fr:"Brouillon secret",slug:"new-path"}});
assert.equal((await findPage(db,{slug:"project-b"})).headline_fr,"Bonjour");assert.equal(await findPage(db,{slug:"new-path"}),null);
const publicResult=await (await resolve(req({slug:"project-b"}))).json();assert.equal(publicResult.page.internal_name,undefined);assert.equal(publicResult.page.published_json,undefined);assert.ok(!JSON.stringify(publicResult).includes("Brouillon secret"));
await assert.rejects(()=>action(db,{action:"save",page:{...payload,name:"Duplicate"}}),/pages_slug_taken/);
assert.throws(()=>cleanPage({...payload,slug:"admin"}),/pages_invalid_slug/);assert.throws(()=>cleanPage({...payload,logo_url:"javascript:alert(1)"}),/pages_url_error/);
await assert.rejects(()=>validatePageType(db,page.id,"unassigned"),/pages_unavailable/);
const duplicate=(await action(db,{action:"duplicate",id:page.id})).page;assert.equal(duplicate.status,"draft");assert.notEqual(duplicate.slug,page.slug);assert.equal(duplicate.published_json,undefined);
await db.Booking.create({booking_page_id:page.id,context_key:"project-b",status:"confirmed",start_at:"2099-01-01T12:00:00Z"});
const list=await action(db,{action:"list"});assert.equal(list.pages.find(p=>p.id===page.id).stats.total,1);assert.equal(list.pages.find(p=>p.id===page.id).stats.upcoming,1);
await action(db,{action:"unpublish",id:page.id});assert.equal(await findPage(db,{slug:"project-b"}),null);await assert.rejects(()=>validatePageType(db,page.id,a.id),/pages_unavailable/);
page=(await action(db,{action:"publish",id:page.id,page:{...page,type_overrides:[{booking_type_id:a.id,visible:false}]}})).page;assert.equal(page.default_booking_type_id,"");assert.equal(pageTypes(await findPage(db,{id:page.id}),[a,b]).length,1);await assert.rejects(()=>validatePageType(db,page.id,a.id),/pages_unavailable/);
await action(db,{action:"delete",id:page.id});assert.equal(rows.Booking.length,1);assert.equal(rows.Booking[0].booking_page_id,page.id);
console.log("PASS pages: admin authorization; private draft preview; published snapshot isolation; unique/reserved URLs; ordered types and text overrides without duration/buffer changes; hidden/unassigned type rejection; publish/unpublish; duplication; stats; deletion preserves bookings. Database mocked.");
})().catch(e=>{console.error(e);process.exit(1)});
