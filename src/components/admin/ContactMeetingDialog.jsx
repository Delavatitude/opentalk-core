import PhoneInput from "@/components/PhoneInput";
import {useState,useEffect} from "react";
import {api} from "@/api/client";
import {useI18n,localizedField} from "@/i18n/I18nContext";
import {CONTEXTS,contextsFor} from "@/lib/bookingContexts";
import DayStrip from "@/components/booking/DayStrip";
import SlotGrid from "@/components/booking/SlotGrid";
import {crmSearch} from "@/lib/crm";
const input="w-full max-w-full min-w-0 border border-border rounded-xl bg-background px-3 py-2 text-sm";
export default function ContactMeetingDialog({contacts,initialContact,mode,onClose,onCreated}) {
  const {t,locale}=useI18n();
  const [query,setQuery]=useState(""),[contactId,setContactId]=useState(initialContact?.id || "");
  const [f,setF]=useState(()=>values(initialContact,locale));
  const [changingContact,setChangingContact]=useState(false);
  const availableContacts=initialContact?.id?[initialContact,...contacts.filter(c=>c.id!==initialContact.id)]:contacts;
  const selectedContact=availableContacts.find(c=>c.id===contactId);
  const showContactPicker=mode!=="invite" || !selectedContact || changingContact;
  const [pages,setPages]=useState([]),[pageId,setPageId]=useState("");
  const page=pages.find(p=>p.id===pageId);
  const [context,setContext]=useState(initialContact?.context || "general"),[types,setTypes]=useState([]),[typeId,setTypeId]=useState("");
  const [days,setDays]=useState([]),[date,setDate]=useState(""),[slot,setSlot]=useState(null),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[link,setLink]=useState(null),[status,setStatus]=useState("");
  const [notifyEmail,setNotifyEmail]=useState(true),[notifySms,setNotifySms]=useState(false);
  const set=(key,value)=>setF(p=>({...p,[key]:value}));
  const visibleTypes=page?(page.booking_type_ids || []).map(id=>types.find(tp=>tp.id===id)).filter(tp=>tp && !page.type_overrides?.some(o=>o.booking_type_id===tp.id && o.visible===false)):types.filter(tp=>contextsFor(tp).includes(context));
  useEffect(()=>{api.entities.BookingType.filter({active:true}).then(setTypes).catch(()=>setError("crm_error"));api.functions.invoke("adminPages",{action:"list"}).then(r=>setPages(r.data.pages.filter(p=>p.status==="published").map(p=>({...JSON.parse(p.published_json),id:p.id})).filter(p=>p.active))).catch(()=>setError("crm_error"));},[]);
  useEffect(()=>{
    if(mode!=="booking" || !typeId)return;
    let active=true;setLoading(true);setSlot(null);setDays([]);setError("");
    api.functions.invoke("getAvailabilityWithCalendars",{booking_type_id:typeId,timezone:f.timezone,locale:f.locale,days:30}).then(r=>{
      if(!active)return;setDays(r.data.days || []);setDate(r.data.days?.find(d=>d.slots.length)?.date || "");
    }).catch(()=>{if(active)setError("crm_invalid_timezone");}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[typeId,f.timezone,f.locale,mode]);
  function choose(id) {setContactId(id);setQuery("");setChangingContact(false);setF(values(availableContacts.find(c=>c.id===id),locale));setLink(null);setStatus("");}
  async function submit(e) {
    e.preventDefault();setBusy(true);setError("");
    try {
      if(mode==="invite") {
        const r=await api.functions.invoke("adminContacts",{action:"generate_link",contact_id:contactId,booking_type_id:typeId,booking_page_id:pageId,context:page?.context_key || context,subject:f.topic});
        setLink(r.data.link);setStatus("");
      } else {
        await api.functions.invoke("createBookingWithMeeting",{booking_type_id:typeId,booking_page_id:pageId,...f,context:page?.context_key || context,source:"admin",notify_email:notifyEmail,notify_sms:notifySms,start_at:slot.start_at,end_at:slot.end_at});
        onCreated();onClose();
      }
    } catch(e) {setError(e.response?.data?.error || "crm_error");} finally {setBusy(false);}
  }
  async function send() {
    setBusy(true);setError("");
    try {const r=await api.functions.invoke("adminContacts",{action:"send_link",link_id:link.id});setStatus(r.data.status);} catch(e){setError(e.response?.data?.error || "crm_error");} finally {setBusy(false);}
  }
  async function copy() {try{await navigator.clipboard.writeText(link.url);setStatus("crm_copied");}catch{setError("crm_copy_failed");}}
  return <div role="dialog" aria-modal="true" aria-labelledby="contact-meeting-title" className="fixed inset-0 z-50 bg-background/90 overflow-y-auto p-4 sm:p-8"><div className="w-full min-w-0 max-w-2xl mx-auto bg-card border rounded-2xl p-4 sm:p-6">
    <div className="flex justify-between gap-3 mb-5"><h2 id="contact-meeting-title" className="font-heading text-xl">{t(mode==="invite"?"crm_send_link":"crm_create_booking")}</h2><button onClick={onClose} disabled={busy}>{t("crm_close")}</button></div>
    <form onSubmit={submit} className="w-full min-w-0 space-y-4"><fieldset disabled={busy || !!link} className="w-full min-w-0 max-w-full space-y-4">
    {mode==="invite" && selectedContact && <section className="min-w-0 rounded-xl border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground mb-1">{t("crm_recipient")}</p><p className="font-medium break-words">{selectedContact.full_name}</p><p className="text-sm break-all">{selectedContact.email}</p></div>
        <button type="button" className="text-sm underline underline-offset-4" aria-expanded={changingContact} aria-controls="invitation-contact-picker" onClick={()=>{setChangingContact(v=>!v);setQuery("");}}>{t(changingContact?"crm_close":"crm_change_contact")}</button>
      </div>
    </section>}
    {showContactPicker && <div id="invitation-contact-picker" className="min-w-0 space-y-3">
      <label className="block min-w-0 text-sm">{t("crm_select")}<input className={input+" mt-1"} placeholder={t("crm_search")} value={query} onChange={e=>setQuery(e.target.value)} /></label>
      <select aria-label={t("crm_select")} className={input} value={contactId} onChange={e=>choose(e.target.value)} required={mode==="invite"}><option value="">{t(mode==="invite"?"crm_select":"crm_new_guest")}</option>{availableContacts.filter(c=>c.id===contactId || crmSearch(c,query)).map(c=><option key={c.id} value={c.id}>{c.full_name}{c.company?" — "+c.company:""} · {c.email}</option>)}</select>
      {mode==="invite" && initialContact?.id && contactId!==initialContact.id && <button type="button" className="text-sm text-left underline underline-offset-4 break-all" onClick={()=>choose(initialContact.id)}>{t("crm_use_current_contact")} · {initialContact.email}</button>}
    </div>}
    {mode==="booking" && <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 gap-3">{["name","email","phone","company"].map(k=><label key={k} className="min-w-0 text-sm">{t(k==="phone"?"crm_phone":k)}{k==="phone"?<PhoneInput className={input} value={f.phone} onChange={v=>set("phone",v)} required={notifySms}/>:<input className={input} type={k==="email"?"email":"text"} required={k==="name"||k==="email"} value={f[k]} onChange={e=>set(k,e.target.value)} />}</label>)}
    <label className="min-w-0 text-sm">{t("crm_locale")}<select className={input} value={f.locale} onChange={e=>set("locale",e.target.value)}><option value="fr">FR</option><option value="en">EN</option></select></label>
    <label className="min-w-0 text-sm">{t("timezone")}<input className={input} value={f.timezone} onChange={e=>set("timezone",e.target.value)} required title={t("crm_timezone_help")} /></label></div>}
    <label className="block min-w-0 text-sm">{t("pages_title")}<select className={input} value={pageId} onChange={e=>{setPageId(e.target.value);setTypeId("");setSlot(null);}}><option value="">{t("pages_none")}</option>{pages.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 gap-3"><label className="min-w-0 text-sm">{t("context")}<select className={input} disabled={!!pageId} value={page?.context_key || context} onChange={e=>{setContext(e.target.value);setTypeId("");setSlot(null);}}>{[...new Set([...CONTEXTS,...pages.map(p=>p.context_key)])].map(c=><option key={c} value={c}>{c==="general"?t("general"):c.toUpperCase()}</option>)}</select></label>
    <label className="min-w-0 text-sm">{t("meeting_type")}<select className={input} value={typeId} onChange={e=>{setTypeId(e.target.value);setSlot(null);}} required><option value="">{t("meeting_type")}</option>{visibleTypes.map(tp=><option key={tp.id} value={tp.id}>{localizedField(tp,"name",f.locale)}</option>)}</select></label></div>
    {!visibleTypes.length && <p className="min-w-0 text-sm">{t("crm_no_types")}</p>}
    <label className="block min-w-0 text-sm">{t("crm_subject")}<textarea className={input} value={f.topic} onChange={e=>set("topic",e.target.value)} /></label>
    {mode==="booking" && typeId && <section className="min-w-0">{loading?<p>{t("crm_loading_slots")}</p>:<><p className="mb-3 text-sm">{t("times_in_tz",{tz:f.timezone})}</p><DayStrip onMoreDates={null} days={days} selectedDate={date} onSelect={d=>{setDate(d.date);setSlot(null);}} /><div className="mt-4"><SlotGrid slots={days.find(d=>d.date===date)?.slots || []} selectedSlot={slot} onSelect={setSlot} /></div></>}</section>}
    {mode==="booking" && <section className="border rounded-xl p-4 space-y-3"><h3 className="font-medium">{t("booking_notifications")}</h3><label className="flex gap-3 items-center"><input type="checkbox" checked={notifyEmail} onChange={e=>setNotifyEmail(e.target.checked)} />{t("booking_notify_email")}</label><label className="flex gap-3 items-center"><input type="checkbox" checked={notifySms} onChange={e=>setNotifySms(e.target.checked)} />{t("booking_notify_sms")}</label><p className="text-sm text-muted-foreground">{t("booking_sms_pending")}</p>{notifySms && <p className="min-w-0 text-sm">{t("booking_sms_phone")}</p>}</section>}
    <button className="rounded-xl bg-primary text-white px-4 py-3 disabled:opacity-40" disabled={busy || !typeId || (mode==="booking"?!slot:!contactId)}>{t(busy?"crm_saving":mode==="invite"?"crm_generate":"confirm_booking")}</button>
    </fieldset></form>
    {link && <div className="mt-5 space-y-3"><p>{t("crm_link_ready")}</p><input aria-label={t("crm_send_link")} className={input} readOnly value={link.url} /><p className="text-xs text-muted-foreground">{t("crm_link_private")}</p><div className="flex flex-wrap gap-3"><button onClick={copy}>{t("crm_copy_link")}</button><button disabled={busy || status==="sent"} onClick={send} className="rounded-xl bg-primary text-white px-4 py-2 disabled:opacity-40">{t("crm_send_email")}</button></div></div>}
    {status && <p className="mt-3" role="status">{t(status==="pending_configuration"?"crm_email_setup":status==="review_required"?"crm_email_review":status==="failed"?"crm_email_failed":status)}</p>}
    {error && <p role="alert" className="mt-3 text-destructive">{t(error)}</p>}
  </div></div>;
}
function values(c,locale) {return {name:c?.full_name || "",email:c?.email || "",phone:c?.phone || "",company:c?.company || "",locale:c?.locale || locale,timezone:c?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",topic:""};}
