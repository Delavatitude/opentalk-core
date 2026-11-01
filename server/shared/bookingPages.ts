import {allRows} from "./contacts.ts";
export const COPY_FIELDS=["headline","subtitle","intro_text","eyebrow","footer_text","primary_cta","secondary_copy","meta_title","meta_description"];
const TEXT_FIELDS=["name","internal_name","context_key","brand_label","context_icon",...COPY_FIELDS.flatMap(k=>[k+"_en",k+"_fr"])];
const RESERVED=["admin","login","register","forgot-password","reset-password","confirmed","m","e","api","preview","assets","en","fr"];
export function normalizeSlug(value) {return String(value ?? "").trim().toLowerCase().replace(/^\/+|\/+$/g,"") || "/";}
export function cleanPage(input) {
 const p={};
 for(const k of TEXT_FIELDS)p[k]=String(input[k] || "").trim().slice(0, k.startsWith("intro")?5000:1000);
 p.slug=normalizeSlug(input.slug);
 if(p.slug!=="/" && (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug)||p.slug.length>80||RESERVED.includes(p.slug)))throw Error("pages_invalid_slug");
 if(!p.name || !/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(p.context_key))throw Error("pages_required");
 p.language_mode=["auto","en","fr"].includes(input.language_mode)?input.language_mode:"auto";
 p.accent_style=["terracotta","sage","blue","plum"].includes(input.accent_style)?input.accent_style:"terracotta";
 p.active=input.active!==false;
 p.github_repo_url=String(input.github_repo_url || "").trim();
 if(p.github_repo_url && !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(p.github_repo_url))throw Error("pages_github_url");
 for(const k of ["logo_url","hero_visual_url"]){p[k]=String(input[k] || "").trim();if(p[k] && !/^https:\/\//i.test(p[k]))throw Error("pages_url_error");}
 p.booking_type_ids=[...new Set((Array.isArray(input.booking_type_ids)?input.booking_type_ids:[]).filter(x=>typeof x==="string"))].slice(0,100);
 p.default_booking_type_id=p.booking_type_ids.includes(input.default_booking_type_id)?input.default_booking_type_id:"";
 p.type_overrides=p.booking_type_ids.map(id=>{const o=(input.type_overrides || []).find(o=>o.booking_type_id===id)||{};return {booking_type_id:id,visible:o.visible!==false,...Object.fromEntries(["name_en","name_fr","description_en","description_fr"].map(k=>[k,String(o[k] || "").trim().slice(0,1000)]))};});
 if(p.type_overrides.find(o=>o.booking_type_id===p.default_booking_type_id)?.visible===false)p.default_booking_type_id="";
 return p;
}
export function publishedPage(row) {
 if(!row || row.status!=="published")return null;
 try{const p=JSON.parse(row.published_json);return p.active?{...p,id:row.id}:null;}catch{return null;}
}
export async function findPage(db,{id,slug}) {
 if(id)return publishedPage(await db.BookingPage.get(id));
 const path=normalizeSlug(slug);
 const rows=await db.BookingPage.filter({published_slug:path,status:"published"},null,2);
 return rows.length===1?publishedPage(rows[0]):null;
}
export function pageTypes(page,types) {
 return (page.booking_type_ids || []).map(id=>{
 const tp=types.find(t=>t.id===id && t.active), o=(page.type_overrides || []).find(o=>o.booking_type_id===id);
 if(!tp || o?.visible===false)return null;
 const result={id:tp.id,name:tp.name,duration:tp.duration,brand:page.brand_label || tp.brand};
 for(const k of ["name_en","name_fr","description_en","description_fr"])result[k]=o?.[k] || tp[k] || tp[k.startsWith("name")?"name":"description"] || "";
 return result;
 }).filter(Boolean);
}
export async function validatePageType(db,pageId,typeId) {
 const page=await findPage(db,{id:pageId});
 if(!page || !(page.booking_type_ids || []).includes(typeId) || page.type_overrides?.some(o=>o.booking_type_id===typeId && o.visible===false))throw Error("pages_unavailable");
 return page;
}
export async function adminPagesAction(db,body) {
 const action=body.action || "list";
 if(action==="list") {
  const [pages,bookings,types,settings]=await Promise.all([allRows(db.BookingPage),allRows(db.Booking),allRows(db.BookingType),db.Setting.filter({key:"app_base_url"})]);
  const now=Date.now();
  const summarize=list=>({total:list.length,upcoming:list.filter(b=>["confirmed","rescheduled"].includes(b.status) && Date.parse(b.start_at)>=now).length,last:list.filter(b=>b.status!=="cancelled" && Date.parse(b.start_at)<now).sort((a,b)=>Date.parse(b.start_at)-Date.parse(a.start_at))[0]?.start_at || ""});
  const pageIds=new Set(pages.map(p=>p.id));
  return {summary:summarize(bookings),unassigned:summarize(bookings.filter(b=>!pageIds.has(b.booking_page_id))),pages:pages.map(p=>({...p,stats:summarize(bookings.filter(b=>b.booking_page_id===p.id))})),types,app_base_url:settings[0]?.value || ""};
 }
 const old=body.id?await db.BookingPage.get(body.id):null;
 if(["unpublish","archive","delete","duplicate"].includes(action) && !old)throw Error("pages_unavailable");
 if(action==="delete"){await db.BookingPage.delete(old.id);return {ok:true};}
 if(action==="unpublish" || action==="archive")return {page:await db.BookingPage.update(old.id,{status:action==="archive"?"archived":"draft",updated_at:new Date().toISOString()})};
 if(!["save","publish","duplicate"].includes(action))throw Error("pages_error");
 const p=cleanPage(action==="duplicate"?{...old,name:old.name+" (copy)",slug:(old.slug==="/"?"general":old.slug)+"-"+crypto.randomUUID().slice(0,6)}:body.page || {});
 const rows=await allRows(db.BookingPage);
 if(rows.some(r=>r.id!==old?.id && (r.slug===p.slug || r.published_slug===p.slug)))throw Error("pages_slug_taken");
 const types=await allRows(db.BookingType);
 if(p.booking_type_ids.some(id=>!types.some(t=>t.id===id)))throw Error("pages_invalid_types");
 if(action==="publish"){
  if(!pageTypes(p,types).length || (p.language_mode==="auto"?["en","fr"]:[p.language_mode]).some(l=>!p["headline_"+l] || !p["primary_cta_"+l]))throw Error("pages_publish_required");
 }
 const now=new Date().toISOString();
 const data={...p,status:action==="publish"?"published":action==="duplicate"?"draft":old?.status || "draft",updated_at:now};
 if(action==="publish")Object.assign(data,{published_json:JSON.stringify(p),published_slug:p.slug});
 if(!old || action==="duplicate")return {page:await db.BookingPage.create({...data,created_at:now})};
 return {page:await db.BookingPage.update(old.id,data)};
}
