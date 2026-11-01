import PhoneInput, {phoneDetails} from "@/components/PhoneInput";
import {useEffect,useState} from "react";
import {useLocation} from "react-router-dom";
import {api} from "@/api/client";
import {useI18n} from "@/i18n/I18nContext";
import {CONTEXTS} from "@/lib/bookingContexts";
import {crmSearch} from "@/lib/crm";
import ContactMeetingDialog from "./ContactMeetingDialog";
const input="w-full min-w-0 border border-border rounded-xl bg-background px-3 py-2 text-sm";
export default function ContactsTab() {
  const {t,locale}=useI18n();
  const location=useLocation();
  const requestedContact=new URLSearchParams(location.search).get("contact");
  useEffect(()=>{if(requestedContact)open(requestedContact);},[requestedContact]);
  const [contacts,setContacts]=useState([]),[query,setQuery]=useState(""),[context,setContext]=useState("all"),[loading,setLoading]=useState(true),[error,setError]=useState(""),[detail,setDetail]=useState(null),[editing,setEditing]=useState(null),[dialog,setDialog]=useState(null),[feedback,setFeedback]=useState("");
  async function load() {
    setLoading(true);setError("");
    try {const r=await api.functions.invoke("adminContacts",{action:"list"});setContacts(r.data.contacts);}catch(e){setError(e.response?.data?.error || "crm_error");}finally{setLoading(false);}
  }
  useEffect(()=>{load();},[]);
  async function open(id) {
    setError("");
    try{const r=await api.functions.invoke("adminContacts",{action:"detail",contact_id:id});setDetail(r.data);}catch(e){setError(e.response?.data?.error || "crm_error");}
  }
  async function copy(value) {try{await navigator.clipboard.writeText(value);setFeedback("crm_copied");}catch{setFeedback("crm_copy_failed");}}
  async function changed() {await load();if(detail)await open(detail.contact.id);}
  function date(value,tz) {if(!value)return "—";try{return new Intl.DateTimeFormat(locale==="fr"?"fr-FR":"en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:tz || "UTC"}).format(new Date(value));}catch{return value;}}
  const badge="inline-flex rounded-full px-2.5 py-1 text-xs font-medium";
  const initials=c=>(c.full_name || c.email || "?").split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase();
  const contexts=c=>[...new Set(c.contexts?.length?c.contexts:[c.context || "general"])];
  const contextLabel=c=>c==="general"?t("general"):["personal","personnel"].includes(c)?t("booking_personal"):c.toUpperCase();
  const tone=c=>({general:"bg-primary/10 text-primary",personal:"bg-violet-100 text-violet-800",personnel:"bg-violet-100 text-violet-800"})[c] || "bg-secondary text-foreground";
  const visible=contacts.filter(c=>crmSearch(c,query) && (context==="all" || c.context===context || c.contexts?.includes(context))).sort((a,b)=>(a.full_name || "").localeCompare(b.full_name || "",locale));
  return <div className="space-y-5 min-w-0">
    <div className="flex flex-wrap justify-between gap-3 items-center"><h1 className="font-heading text-2xl">{t("crm_contacts")}</h1><div className="flex flex-wrap gap-3"><button className="border rounded-xl px-3 py-2" onClick={()=>setDialog({mode:"booking"})}>{t("crm_create_booking")}</button><button className="bg-primary text-white rounded-xl px-3 py-2" onClick={()=>setEditing({locale,timezone:"UTC",context:"general",status:"lead"})}>{t("crm_new")}</button></div></div>
    {error && <p role="alert" className="text-destructive">{t(error)}</p>}
    {feedback && <p role="status">{t(feedback)}</p>}
    {detail ? <section className="space-y-5">
      <button onClick={()=>setDetail(null)}>{t("back")}</button>
      <div className="bg-card border rounded-2xl overflow-hidden">
        <div className="p-4 sm:p-6 space-y-5">
          <div className="flex flex-wrap justify-between gap-4"><div className="flex gap-3 min-w-0"><span className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-heading text-lg shrink-0">{initials(detail.contact)}</span><div className="min-w-0"><h2 className="font-heading text-2xl break-words">{detail.contact.full_name}</h2>{detail.contact.company && <p className="text-muted-foreground">{detail.contact.company}</p>}</div></div><button className="border rounded-xl px-3 py-2 text-sm self-start" onClick={()=>setEditing(detail.contact)}>{t("crm_edit")}</button></div>
          <div className="flex flex-wrap gap-2"><span className={badge+" bg-secondary"}>{t("crm_"+(detail.contact.status || "lead"))}</span>{contexts(detail.contact).map(c=><span key={c} className={badge+" "+tone(c)}>{contextLabel(c)}</span>)}{(detail.contact.tags || []).map(tag=><span key={tag} className={badge+" border text-muted-foreground"}>{tag}</span>)}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div className="min-w-0 rounded-xl bg-background/60 p-4"><p className="text-xs text-muted-foreground mb-1">{t("email")}</p><a className="break-all hover:underline" href={"mailto:"+encodeURIComponent(detail.contact.email)}>{detail.contact.email}</a><button className="block text-xs text-primary mt-2" onClick={()=>copy(detail.contact.email)}>{t("crm_copy_email")}</button></div><div className="min-w-0 rounded-xl bg-background/60 p-4"><p className="text-xs text-muted-foreground mb-1">{t("crm_phone")}</p>{detail.contact.phone?<><a className="hover:underline" href={"tel:"+detail.contact.phone.replace(/[^+0-9]/g,"")}>{phoneDetails(detail.contact.phone)?.display || detail.contact.phone}</a><p className="text-xs text-muted-foreground mt-1">{t("phone_country")} : {phoneDetails(detail.contact.phone)?.code || t("phone_unknown")}{phoneDetails(detail.contact.phone)?.country ? " · "+new Intl.DisplayNames([locale],{type:"region"}).of(phoneDetails(detail.contact.phone).country):""}</p><button className="block text-xs text-primary mt-2" onClick={()=>copy(detail.contact.phone)}>{t("crm_copy_phone")}</button></>:<span>—</span>}</div></div>
          <div className="flex flex-wrap gap-2 text-sm"><button className="bg-primary text-white rounded-xl px-4 py-2" onClick={()=>setDialog({mode:"booking",contact:detail.contact})}>{t("crm_create_booking")}</button><button className="border rounded-xl px-4 py-2" onClick={()=>setDialog({mode:"invite",contact:detail.contact})}>{t("crm_send_link")}</button><a className="border rounded-xl px-4 py-2" href={"mailto:"+encodeURIComponent(detail.contact.email)}>{t("crm_email_action")}</a>{detail.contact.phone && <a className="border rounded-xl px-4 py-2" href={"tel:"+detail.contact.phone.replace(/[^+0-9]/g,"")}>{t("crm_call")}</a>}</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{[["crm_total",detail.contact.total_bookings || 0],["crm_first_booking",date(detail.contact.first_booking_at,detail.contact.timezone)],["crm_last_meeting",date(detail.contact.last_booking_at,detail.contact.timezone)]].map(([key,value])=><div key={key} className="border rounded-xl p-3"><p className="text-xs text-muted-foreground">{t(key)}</p><p className="font-medium mt-1">{value}</p></div>)}</div>
          <div className="border-t pt-4"><h3 className="font-heading mb-2">{t("crm_notes")}</h3><p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{detail.contact.notes || "—"}</p></div>
        </div>
        <details className="border-t px-4 sm:px-6 py-3"><summary className="cursor-pointer text-sm text-muted-foreground">{t("contact_more_details")}</summary><dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 text-sm">{["first_name","last_name","locale","timezone","source"].map(k=><div key={k} className="min-w-0"><dt className="text-xs text-muted-foreground">{t(({first_name:"crm_first_name",last_name:"crm_last_name",locale:"crm_locale",source:"contact_source"})[k] || k)}</dt><dd className="break-words">{detail.contact[k] || "—"}</dd></div>)}</dl></details>
      </div>
      <h2 className="font-heading text-xl">{t("crm_history")}</h2>
      {["upcoming","past","cancelled"].map(group=>{
        const items=detail.bookings.filter(b=>group==="cancelled"?b.status==="cancelled":b.status!=="cancelled" && (group==="upcoming"?Date.parse(b.start_at)>=Date.now():Date.parse(b.start_at)<Date.now())).sort((a,b)=>group==="upcoming"?Date.parse(a.start_at)-Date.parse(b.start_at):Date.parse(b.start_at)-Date.parse(a.start_at));
        return <section key={group}><h3 className="font-heading mb-3 flex items-center gap-2">{t("crm_"+group)}<span className={badge+" bg-secondary"}>{items.length}</span></h3>{!items.length?<p className="text-sm text-muted-foreground">{t("crm_no_meetings")}</p>:<div className="space-y-2">{items.map(b=><article key={b.id} className="border bg-card rounded-2xl p-4 space-y-2"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">{b.booking_type_name}</p><span className={badge+" "+tone(b.context_key || b.context)}>{contextLabel(b.context_key || b.context || "general")}</span></div><p className="text-sm">{date(b.start_at,b.timezone)} · {b.timezone} · {(b.locale || "en").toUpperCase()} · {t(b.status)}</p>{b.topic && <p className="text-sm text-muted-foreground">{b.topic}</p>}{b.meeting_url && /^https?:\/\//.test(b.meeting_url) && <a className="text-sm text-primary" href={b.meeting_url} target="_blank" rel="noopener noreferrer">{t("join_meeting")}</a>}</article>)}</div>}</section>;
      })}
      {!!detail.links?.length && <section><h3 className="font-heading mb-3">{t("crm_invitations")}</h3>{detail.links.map(l=><div key={l.id} className="text-sm border rounded-xl p-3 mb-2">{l.title} · {t(l.invitation_status || "not_sent")}{l.invitation_error && <p className="text-destructive">{t(l.invitation_error)}</p>}</div>)}</section>}
    </section> : <>
    <div className="flex flex-col sm:flex-row gap-3"><input className={input} value={query} onChange={e=>setQuery(e.target.value)} placeholder={t("crm_search")} aria-label={t("crm_search")} /><select className={input+" sm:max-w-48"} value={context} onChange={e=>setContext(e.target.value)} aria-label={t("context")}>{["all",...new Set(contacts.flatMap(contexts))].map(c=><option key={c} value={c}>{c==="all"?t("all"):contextLabel(c)}</option>)}</select><button onClick={load}>{t("refresh")}</button></div>
    {loading?<p>{t("loading")}</p>:!visible.length?<p className="text-muted-foreground">{t(contacts.length?"crm_no_results":"crm_no_contacts")}</p>:<div className="space-y-3">{visible.map(c=><div key={c.id} className="relative border rounded-2xl bg-card p-4 sm:p-5 hover:border-primary/50 hover:shadow-sm transition-all focus-within:ring-2 focus-within:ring-primary">
      <div className="flex gap-3 items-start"><span aria-hidden="true" className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-heading shrink-0">{initials(c)}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-heading text-base font-semibold"><button type="button" onClick={()=>open(c.id)} className="text-left after:absolute after:inset-0 after:rounded-2xl focus:outline-none">{c.full_name}</button></h2>{c.company && <p className="text-sm text-muted-foreground">{c.company}</p>}</div><span className={badge+" bg-secondary self-start"}>{t("crm_"+(c.status || "lead"))}</span></div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground mt-2"><a className="relative z-10 break-all hover:underline" href={"mailto:"+encodeURIComponent(c.email)}>{c.email}</a>{c.phone && <a className="relative z-10 hover:underline" href={"tel:"+c.phone.replace(/[^+0-9]/g,"")}>{c.phone}</a>}</div>
      <div className="flex flex-wrap items-center gap-2 mt-3">{contexts(c).map(key=><span key={key} className={badge+" "+tone(key)}>{contextLabel(key)}</span>)}<span className="text-xs text-muted-foreground sm:ml-auto">{t("crm_total")} : {c.total_bookings || 0}</span><span aria-hidden="true" className="text-primary ml-1">→</span></div>
      <p className="text-xs text-muted-foreground mt-2">{t("crm_last_meeting")} : {date(c.last_booking_at,c.timezone)}</p>
      </div></div>
    </div>)}</div>}</>}
    {editing && <ContactEditor initial={editing} onClose={()=>setEditing(null)} onSaved={async()=>{setEditing(null);await changed();setFeedback("crm_created");}} />}
    {dialog && <ContactMeetingDialog contacts={contacts} initialContact={dialog.contact} mode={dialog.mode} onClose={()=>{setDialog(null);if(detail)open(detail.contact.id);}} onCreated={async()=>{setFeedback("crm_booked");await changed();}} />}
  </div>;
}
function ContactEditor({initial,onClose,onSaved}) {
  const {t}=useI18n();const [f,setF]=useState({...initial,tags:(initial.tags || []).join(", ")}),[busy,setBusy]=useState(false),[error,setError]=useState("");
  function set(k,v){setF(p=>({...p,[k]:v}));}
  async function submit(e){e.preventDefault();setBusy(true);setError("");try{await api.functions.invoke("adminContacts",{action:"save",contact:{...f,tags:(f.tags || "").split(",").map(s=>s.trim()).filter(Boolean)}});await onSaved();}catch(e){setError(e.response?.data?.error || "crm_error");}finally{setBusy(false);}}
  return <div role="dialog" aria-modal="true" aria-labelledby="contact-editor-title" className="fixed inset-0 z-50 bg-background/90 overflow-y-auto p-4 sm:p-8"><form onSubmit={submit} className="max-w-xl mx-auto bg-card border rounded-2xl p-4 sm:p-6 space-y-4"><div className="flex justify-between gap-3"><h2 id="contact-editor-title" className="font-heading text-xl">{t(initial.id?"crm_edit":"crm_new")}</h2><button type="button" disabled={busy} onClick={onClose}>{t("crm_close")}</button></div>
  <fieldset disabled={busy} className="grid grid-cols-1 sm:grid-cols-2 gap-3">{["first_name","last_name","full_name","email","phone","company"].map(k=><label key={k} className="text-sm">{t(["email","company"].includes(k)?k:"crm_"+k)}{k==="phone"?<PhoneInput className={input} value={f.phone || ""} onChange={v=>set("phone",v)}/>:<input className={input} type={k==="email"?"email":"text"} value={f[k] || ""} onChange={e=>set(k,e.target.value)} required={k==="email"} readOnly={k==="email" && !!initial.id} />}</label>)}
  <label className="text-sm">{t("crm_locale")}<select className={input} value={f.locale || "en"} onChange={e=>set("locale",e.target.value)}><option value="fr">FR</option><option value="en">EN</option></select></label>
  <label className="text-sm">{t("timezone")}<input className={input} value={f.timezone || ""} onChange={e=>set("timezone",e.target.value)} required /></label>
  <label className="text-sm">{t("context")}<select className={input} value={f.context || "general"} onChange={e=>set("context",e.target.value)}>{CONTEXTS.map(c=><option key={c} value={c}>{c==="general"?t("general"):c.toUpperCase()}</option>)}</select></label>
  <label className="text-sm">{t("crm_status")}<select className={input} value={f.status || "lead"} onChange={e=>set("status",e.target.value)}>{["lead","active_client","partner","inactive"].map(s=><option key={s} value={s}>{t("crm_"+s)}</option>)}</select></label>
  <label className="text-sm sm:col-span-2">{t("crm_tags")}<input className={input} value={f.tags} onChange={e=>set("tags",e.target.value)} /></label>
  <label className="text-sm sm:col-span-2">{t("crm_notes")}<textarea className={input+" min-h-28"} value={f.notes || ""} onChange={e=>set("notes",e.target.value)} /></label></fieldset>
  {initial.id && <p className="text-xs text-muted-foreground">{t("crm_email_hint")}</p>}
  {error && <p role="alert" className="text-destructive">{t(error)}</p>}<button className="bg-primary text-white rounded-xl px-4 py-3 disabled:opacity-40" disabled={busy}>{t(busy?"crm_saving":"save")}</button>
  </form></div>;
}
