import {useEffect,useState} from "react";
import {api} from "@/api/client";
import {useI18n,localizedField} from "@/i18n/I18nContext";
const input="w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2 text-sm";
const btn="rounded-xl border border-border px-3 py-2 text-sm hover:bg-secondary disabled:opacity-40";
const empty={name:"",slug:"",internal_name:"",context_key:"",language_mode:"auto",active:true,accent_style:"terracotta",booking_type_ids:[],type_overrides:[],default_booking_type_id:""};
const fields=["headline","subtitle","intro_text","eyebrow","footer_text","primary_cta","secondary_copy","meta_title","meta_description"];
export default function PagesTab({active=true,additionalPagesOnly=false}){
 const {t,locale,formatDate}=useI18n();
 const [pages,setPages]=useState([]),[types,setTypes]=useState([]),[base,setBase]=useState(""),[f,setF]=useState(null),[query,setQuery]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[preview,setPreview]=useState(null),[previewLang,setPreviewLang]=useState(locale),[device,setDevice]=useState("desktop");
 const [summary,setSummary]=useState(null),[unassigned,setUnassigned]=useState(null);
 const [baseline,setBaseline]=useState("");
 const dirty=!!f && baseline!==JSON.stringify(f);
 function discard(){return !dirty || window.confirm(locale==="fr"?"Abandonner les modifications non enregistrées ?":"Discard unsaved changes?");}
 function editPage(page){if(!discard())return;setF(page);setBaseline(JSON.stringify(page));}
 function closeEditor(){if(!busy && discard()){setF(null);setBaseline("");}}
 const set=(k,v)=>setF(p=>({...p,[k]:v}));
 async function load(){setError("");try{const {data}=await api.functions.invoke("adminPages",{action:"list"});setPages(additionalPagesOnly?data.pages.filter(page=>page.slug!=="/" && page.published_slug!=="/"):data.pages);setSummary(data.summary);setUnassigned(data.unassigned);setTypes(data.types);setBase(data.app_base_url || window.location.origin);}catch{setError("load_error");}}
 useEffect(()=>{if(active)load();},[active,additionalPagesOnly]);
 async function action(action,row=f,draftOnly=false){
  setBusy(true);setError("");setNotice("");
  try{
   const operation=action==="save" && row?.status==="published" && !draftOnly?"publish":action;
   const {data}=await api.functions.invoke("adminPages",{action:operation,id:row?.id,page:row});
   if(action==="save" || action==="publish" || action==="duplicate"){setF(data.page);setBaseline(JSON.stringify(data.page));}
   else if(f?.id===row?.id)setF(null);
   await load();setNotice(operation==="save"?"pages_saved":"saved");
   return data.page;
  }catch(e){setError(e.response?.data?.error || "pages_error");return null;}finally{setBusy(false);}
 }
 async function showPreview(row){const saved=row===f?await action("save",row,true):row;if(saved)setPreview(saved.id);}
 function override(id,k,v){set("type_overrides",[...(f.type_overrides || []).filter(o=>o.booking_type_id!==id),{...(f.type_overrides || []).find(o=>o.booking_type_id===id),booking_type_id:id,[k]:v}]);}
 function move(i,delta){const ids=[...f.booking_type_ids];[ids[i],ids[i+delta]]=[ids[i+delta],ids[i]];set("booking_type_ids",ids);}
 async function copy(p){try{await navigator.clipboard.writeText(base.replace(/\/$/,"")+(p.published_slug && p.status==="published"?(p.published_slug==="/"?"":"/"+p.published_slug):(p.slug==="/"?"":"/"+p.slug)));setNotice("crm_copied");}catch{setError("crm_copy_failed");}}
 return <section className="space-y-5">
 <div className="flex flex-wrap justify-between gap-3"><h1 className="font-heading text-2xl">{additionalPagesOnly?(locale==="fr"?"Pages de réservation supplémentaires":"Additional booking pages"):t("pages_title")}</h1><button className={btn+" bg-primary text-white"} onClick={()=>{editPage({...empty});setError("");setNotice("");}}>{t("pages_new")}</button></div>
 {error && <p role="alert" className="text-destructive">{t(error)}</p>}{notice && <p role="status">{t(notice)}</p>}
 {!f ? <>{summary && <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{[["pages_total",summary.total],["pages_upcoming",summary.upcoming],["pages_unassigned",unassigned?.total || 0]].map(([key,value])=><div key={key} className="border rounded-2xl bg-card p-4"><p className="text-sm text-muted-foreground">{t(key)}</p><p className="font-heading text-3xl mt-2">{value}</p></div>)}</div>}{unassigned?.total>0 && <div className="border rounded-xl p-4 text-sm space-y-2"><p>{t("pages_unassigned_help")}</p><p>{t("pages_upcoming")} : {unassigned.upcoming}</p><a href="/admin/bookings" className="text-primary underline">{t("dash_all_bookings")}</a></div>}<div className="flex justify-end"><button className={btn} onClick={load}>{t("refresh")}</button></div><input className={input} aria-label={t("pages_search")} placeholder={t("pages_search")} value={query} onChange={e=>setQuery(e.target.value)}/>
 <div className="grid gap-4">{pages.filter(p=>(p.name+" "+p.slug+" "+p.context_key).toLowerCase().includes(query.toLowerCase())).map(p=><article key={p.id} className="rounded-2xl bg-card border p-5">
 <div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-lg font-semibold">{p.name}</h2><p className="text-sm break-all">/{p.slug==="/"?"":p.slug}</p></div><span className="text-sm">{t("pages_"+p.status)}{!p.active?" · "+t("inactive"):""}</span></div>
 <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4 text-sm">{[["total",p.stats.total],["upcoming",p.stats.upcoming],["last",p.stats.last?formatDate(p.stats.last):"—"]].map(([k,v])=><div key={k}><dt className="text-muted-foreground">{t("pages_"+k)}</dt><dd>{v}</dd></div>)}</dl>
 <div className="flex flex-wrap gap-2"><button className={btn} onClick={()=>editPage(p)}>{t("pages_edit")}</button><button className={btn} disabled={busy} onClick={()=>action("duplicate",p)}>{t("pages_duplicate")}</button><button className={btn} onClick={()=>showPreview(p)}>{t("pages_preview")}</button><button className={btn} disabled={busy} onClick={()=>action(p.status==="published"?"unpublish":"publish",p)}>{t(p.status==="published"?"pages_unpublish":"pages_publish")}</button><button className={btn} onClick={()=>copy(p)}>{t("pages_copy")}</button><button className={btn} disabled={busy} onClick={()=>action("archive",p)}>{t("pages_archive")}</button><button className={btn} disabled={busy} onClick={()=>{if(window.confirm(t("pages_delete_confirm")))action("delete",p);}}>{t("pages_delete")}</button></div>
 </article>)}</div>{!pages.length && <p>{t("pages_empty")}</p>}</>:
 <div className="rounded-2xl border bg-card p-4 sm:p-6 space-y-6">
 <div className="flex justify-between gap-3"><h2 className="font-heading text-xl">{f.name || t("pages_new")}</h2><button className={btn} disabled={busy} onClick={closeEditor}>{t("pages_close")}</button></div>
 {dirty && <p role="status" className="text-xs text-muted-foreground">{locale==="fr"?"Modifications non enregistrées":"Unsaved changes"}</p>}
 <fieldset disabled={busy} className="space-y-6">
 <div className="grid sm:grid-cols-2 gap-4">{["name","slug","internal_name","context_key","brand_label","logo_url","hero_visual_url","context_icon"].map(k=><label key={k} className="text-sm">{t("pages_"+k)}<input className={input+" mt-1"} value={f[k] || ""} onChange={e=>set(k,e.target.value)} /></label>)}
 <label className="text-sm">{t("pages_language_mode")}<select className={input} value={f.language_mode} onChange={e=>set("language_mode",e.target.value)}>{["auto","en","fr"].map(l=><option key={l} value={l}>{l==="auto"?t("pages_auto"):l.toUpperCase()}</option>)}</select></label>
 <label className="text-sm">{t("pages_accent_style")}<select className={input} value={f.accent_style} onChange={e=>set("accent_style",e.target.value)}>{["terracotta","sage","blue","plum"].map(l=><option key={l} value={l}>{t("pages_"+l)}</option>)}</select></label></div>
 <label className="flex gap-2 text-sm"><input type="checkbox" checked={f.active} onChange={e=>set("active",e.target.checked)}/>{t("pages_active")}</label>
 <div className="grid lg:grid-cols-2 gap-6">{["en","fr"].map(l=><section key={l} className="space-y-3 min-w-0"><h3 className="font-semibold border-b pb-2">{l.toUpperCase()}</h3>{fields.map(k=><label className="block text-sm" key={k}>{t("pages_"+k)}<textarea rows={k==="intro_text"?3:2} className={input+" mt-1"} value={f[k+"_"+l] || ""} onChange={e=>set(k+"_"+l,e.target.value)}/></label>)}</section>)}</div>
 <section className="space-y-3"><h3 className="font-semibold">{t("pages_types")}</h3>
 <select className={input} aria-label={t("pages_add_type")} value="" onChange={e=>{if(e.target.value)set("booking_type_ids",[...f.booking_type_ids,e.target.value]);}}><option value="">{t("pages_add_type")}</option>{types.filter(tp=>!f.booking_type_ids.includes(tp.id)).map(tp=><option key={tp.id} value={tp.id}>{localizedField(tp,"name",locale)}{!tp.active?" ("+t("inactive")+")":""}</option>)}</select>
 {f.booking_type_ids.map((id,i)=>{const tp=types.find(tp=>tp.id===id),o=f.type_overrides?.find(o=>o.booking_type_id===id)||{};return <div key={id} className="border rounded-xl p-3 space-y-3"><div className="flex flex-wrap items-center gap-2"><strong className="mr-auto text-sm">{tp?localizedField(tp,"name",locale):id} · {tp?.duration} min</strong><button className={btn} disabled={!i} onClick={()=>move(i,-1)}>{t("pages_up")}</button><button className={btn} disabled={i===f.booking_type_ids.length-1} onClick={()=>move(i,1)}>{t("pages_down")}</button><button className={btn} onClick={()=>set("booking_type_ids",f.booking_type_ids.filter(x=>x!==id))}>{t("pages_remove")}</button></div>
 <label className="flex gap-2 text-sm"><input type="checkbox" checked={o.visible!==false} onChange={e=>override(id,"visible",e.target.checked)}/>{t("pages_visible")}</label>
 <details><summary className="cursor-pointer text-sm">{t("pages_override")}</summary><div className="grid sm:grid-cols-2 gap-3 mt-3">{["en","fr"].map(l=><div key={l} className="space-y-2"><p>{l.toUpperCase()}</p>{["name","description"].map(k=><label className="block text-sm" key={k}>{t("pages_"+k+"_override")}<input className={input} value={o[k+"_"+l] || ""} placeholder={tp?.[k+"_"+l] || ""} onChange={e=>override(id,k+"_"+l,e.target.value)}/></label>)}</div>)}</div></details></div>;})}
 <label className="block text-sm">{t("pages_default")}<select className={input} value={f.default_booking_type_id || ""} onChange={e=>set("default_booking_type_id",e.target.value)}><option value="">{t("pages_none")}</option>{f.booking_type_ids.filter(id=>!f.type_overrides?.some(o=>o.booking_type_id===id && o.visible===false)).map(id=><option key={id} value={id}>{localizedField(types.find(tp=>tp.id===id),"name",locale)}</option>)}</select></label></section>
 <div className="flex flex-wrap gap-3"><button className={btn} onClick={()=>action("save")}>{f.status==="published"?(locale==="fr"?"Enregistrer et mettre à jour":"Save and update"):t("pages_save")}</button><button className={btn+" bg-primary text-white"} onClick={()=>action("publish")}>{t("pages_publish")}</button><button className={btn} onClick={()=>showPreview(f)}>{t("pages_preview")}</button></div>
 </fieldset></div>}
 {preview && <div role="dialog" aria-modal="true" aria-label={t("pages_preview")} className="fixed inset-0 z-50 bg-background overflow-y-auto p-3 sm:p-6"><div className="flex flex-wrap gap-3 items-center mb-4"><h2 className="mr-auto">{t("pages_preview")}</h2><select aria-label={t("pages_language_mode")} className={btn} value={previewLang} onChange={e=>setPreviewLang(e.target.value)}><option value="en">EN</option><option value="fr">FR</option></select><select aria-label={t("pages_preview")} className={btn} value={device} onChange={e=>setDevice(e.target.value)}><option value="desktop">{t("pages_desktop")}</option><option value="mobile">{t("pages_mobile")}</option></select><button className={btn} onClick={()=>setPreview(null)}>{t("pages_close")}</button></div><p className="text-sm mb-3">{t("pages_preview_notice")} {t("pages_preview_save")}</p><iframe title={t("pages_preview")} key={preview+previewLang} src={"/preview/"+preview+"?lang="+previewLang} className="mx-auto block border rounded-2xl bg-background" style={{width:device==="mobile"?"390px":"100%",maxWidth:"100%",height:"80vh"}}/></div>}
 </section>;
}
