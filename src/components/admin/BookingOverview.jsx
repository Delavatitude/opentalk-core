import AdminBookingDialog from "./AdminBookingDialog";
import CreateBookingButton from "./CreateBookingButton";
import { useEffect, useState, useRef, useCallback } from "react";
import { api } from "@/api/client";
import { useI18n } from "@/i18n/I18nContext";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarDays, UserRound, Mail, Phone, Video } from "lucide-react";
import { CONTEXTS } from "@/lib/bookingContexts";
export default function BookingOverview() {
  const { t, locale } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editing,setEditing]=useState(null),[feedback,setFeedback]=useState(""),[highlighted,setHighlighted]=useState("");
  const [retrying,setRetrying]=useState(""),[retryError,setRetryError]=useState("");
  async function retryCalendar(id){setRetrying(id);setRetryError("");try{const r=await api.functions.invoke("syncBookingCalendars",{booking_id:id});if(!r.data.success)setRetryError(id);await load();}catch{setRetryError(id);}finally{setRetrying("");}}
  const [bookings, setBookings] = useState([]), [logs, setLogs] = useState([]);
  const [context, setContext] = useState("all"), [period, setPeriod] = useState("upcoming"), [loading, setLoading] = useState(true), [syncing, setSyncing] = useState(false), [error, setError] = useState(false);
  const [pageIndex,setPageIndex]=useState(0),[hasMore,setHasMore]=useState(false),[syncMessage,setSyncMessage]=useState("");
  const generation=useRef(0),lastSync=useRef(0);
  const load=useCallback(async(sync=false,background=false)=>{
    const request=++generation.current;
    if(!background)setLoading(true);
    if(sync)setSyncing(true);
    setError(false);
    try{
      const now=new Date().toISOString();
      const query=period==="cancelled"?{status:"cancelled"}:{status:{$in:["confirmed","rescheduled"]},start_at:{[period==="upcoming"?"$gte":"$lt"]:now}};
      if(context!=="all")query.$or=[{context_key:context},{context}];
      const getPage=()=>api.entities.Booking.filter(query,period==="upcoming"?"start_at":"-start_at",21,pageIndex*20);
      let rows=await getPage();
      if(sync===true){
        setSyncMessage("");lastSync.current=Date.now();
        const ids=rows.slice(0,20).filter(b=>b.calendar_event_id || b.google_calendar_events?.length).map(b=>b.id);
        const results=[];
        for(let i=0;i<ids.length;i+=5){
          if(request!==generation.current)return;
          const r=await api.functions.invoke("refreshGoogleBookings",{booking_ids:ids.slice(i,i+5)});
          results.push(...r.data.results);
          if(r.data.results.some(v=>v.status==="external_sync_rate_limit"))break;
        }
        if(request!==generation.current)return;
        setSyncMessage(results.some(r=>r.status.startsWith("external_sync_"))?"external_sync_attention":"");
        rows=await getPage();
      }
      const b=rows.slice(0,20);
      if(request!==generation.current)return;
      setBookings(b);setHasMore(rows.length>20);
      if(!background)setLoading(false);

      const clauses=b.map(v=>({booking_id:v.id,revision:v.notification_revision || v.start_at}));
      try{
        const l=clauses.length?await api.entities.EmailLog.filter({$or:clauses},"-created_date",200):[];
        if(request===generation.current)setLogs(l);
      }catch{
        if(request===generation.current)setLogs([]);
      }
    }catch{if(request===generation.current){if(!background){setError(true);setBookings([]);}setSyncMessage("external_sync_failed");}}
    finally{if(request===generation.current){if(!background)setLoading(false);if(sync)setSyncing(false);}}
  },[context,period,pageIndex]);
  useEffect(()=>{
    let active=true;
    load(false).then(()=>{if(active)load(true,true);});
    return()=>{active=false;generation.current++;};
  },[load]);
  useEffect(()=>{
    const onFocus=()=>{if(!document.hidden && !editing && !loading && !syncing && Date.now()-lastSync.current>300000)load(true,true);};
    window.addEventListener("focus",onFocus);document.addEventListener("visibilitychange",onFocus);
    return()=>{window.removeEventListener("focus",onFocus);document.removeEventListener("visibilitychange",onFocus);};
  },[load,editing,loading,syncing]);
  useEffect(()=>{
    const bookingId=searchParams.get("booking");
    if(!bookingId || loading)return;
    let active=true;
    const focus=async()=>{
      let target=bookings.find(b=>b.id===bookingId);
      if(!target)try{
        target=await api.entities.Booking.get(bookingId);
        if(active && target)setBookings(current=>current.some(b=>b.id===target.id)?current:[target,...current]);
      }catch{return;}
      if(!active || !target)return;
      setHighlighted(target.id);
      const next=new URLSearchParams(searchParams);
      next.delete("booking");
      setSearchParams(next,{replace:true});
    };
    focus();
    return()=>{active=false;};
  },[bookings,loading,searchParams,setSearchParams]);
  useEffect(()=>{
    if(!highlighted)return;
    const frame=requestAnimationFrame(()=>document.getElementById("booking-"+highlighted)?.scrollIntoView({behavior:"smooth",block:"center"}));
    const timer=setTimeout(()=>setHighlighted(""),4000);
    return()=>{cancelAnimationFrame(frame);clearTimeout(timer);};
  },[highlighted]);
  const contextOf=b=>b.context_key || (CONTEXTS.includes(b.context) || ["personal","personnel"].includes(b.context) ? b.context : "general");
  const contexts=[...new Set([...CONTEXTS,...bookings.map(contextOf)])];
  const label=c=>["personal","personnel"].includes(c)?t("booking_personal"):c==="general"?t("general"):c.toUpperCase();
  const tone=c=>({general:"bg-primary/10 text-primary",personal:"bg-violet-100 text-violet-800",personnel:"bg-violet-100 text-violet-800"})[c] || "bg-secondary text-foreground";
  const visible=bookings.filter(b=>(context==="all" || contextOf(b)===context) && (period==="cancelled"?b.status==="cancelled":b.status!=="cancelled" && (period==="upcoming"?Date.parse(b.start_at)>=Date.now():Date.parse(b.start_at)<Date.now()))).sort((a,b)=>period==="upcoming"?Date.parse(a.start_at)-Date.parse(b.start_at):Date.parse(b.start_at)-Date.parse(a.start_at));
  const format=(b,options)=>{try{return new Intl.DateTimeFormat(locale==="fr"?"fr-FR":"en-GB",{...options,timeZone:b.timezone || "UTC"}).format(new Date(b.start_at));}catch{return "—";}};
  const badge="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium";
  return <div className="space-y-5">
    {editing && <AdminBookingDialog booking={editing} onClose={()=>setEditing(null)} onChanged={async message=>{setFeedback(message);await load();}}/>}
    {feedback && <p role="status">{t(feedback)}</p>}
    {syncing && <p role="status" className="text-sm text-muted-foreground">{t("external_sync_running")}</p>}
    {!syncing && syncMessage && <p role="status" className="text-sm text-muted-foreground">{t(syncMessage)}</p>}
    <div className="flex gap-3"><button disabled={loading || pageIndex===0} onClick={()=>setPageIndex(v=>v-1)}>{t("back")}</button><span>{pageIndex+1}</span><button disabled={loading || !hasMore} onClick={()=>setPageIndex(v=>v+1)}>{t("external_sync_next")}</button></div>
    <div className="flex flex-wrap justify-between items-center gap-3"><div><h1 className="font-heading text-2xl">{t("pages_bookings")}</h1><p className="text-sm text-muted-foreground mt-1">{t("booking_view_intro")}</p></div><div className="flex flex-wrap items-center gap-2"><Link to="/admin/links" className="inline-flex items-center rounded-xl border px-4 py-2 text-sm hover:bg-secondary">{t("tab_links")}</Link><CreateBookingButton onCreated={load}/></div></div>
    <div className="flex flex-wrap items-center gap-3"><select aria-label={t("context")} className="bg-card rounded-xl border p-2" value={context} onChange={e=>{setContext(e.target.value);setPageIndex(0);}}><option value="all">{t("all")}</option>{contexts.map(c=><option key={c} value={c}>{label(c)}</option>)}</select><select aria-label={t("your_booking")} className="bg-card rounded-xl border p-2" value={period} onChange={e=>{setPeriod(e.target.value);setPageIndex(0);}}>{["upcoming","past","cancelled"].map(p=><option key={p} value={p}>{t(p==="upcoming"?"tab_upcoming":p)}</option>)}</select><button onClick={()=>load(true,true)} disabled={loading || syncing || !!editing} className="text-sm">{t(syncing?"external_sync_running":"external_sync_refresh")}</button>{!loading && !error && <span className="text-sm text-muted-foreground ml-auto">{visible.length} {t("booking_results")}</span>}</div>
    {loading?<p role="status">{t("loading")}</p>:error?<p role="alert">{t("load_error")}</p>:!visible.length?<p className="border rounded-2xl bg-card p-8 text-center text-muted-foreground">{t("booking_empty")}</p>:visible.map(b=>{
      let observed=[];try{observed=JSON.parse(b.external_observed || "[]");}catch{}
      const currentLogs=logs.filter(l=>l.booking_id===b.id && l.revision===(b.notification_revision || b.start_at));
      const attention=currentLogs.some(l=>["failed","pending_configuration","review_required"].includes(l.status));
      return <article id={"booking-"+b.id} key={b.id} className={"bg-card border rounded-2xl overflow-hidden transition-shadow "+(highlighted===b.id?"ring-2 ring-primary shadow-soft":"")}>
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-5">
          <div className="sm:w-24 shrink-0 rounded-xl bg-secondary/60 p-3 flex sm:flex-col items-center justify-between sm:justify-center gap-2 text-center"><span className="text-xs uppercase tracking-wide">{format(b,{month:"short"})}</span><span className="font-heading text-3xl">{format(b,{day:"2-digit"})}</span><span className="text-sm font-medium">{format(b,{hour:"2-digit",minute:"2-digit"})}</span></div>
          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex flex-wrap items-center gap-2"><span className={badge+" "+tone(contextOf(b))}>{label(contextOf(b))}</span><span className={badge+" "+(b.status==="cancelled"?"bg-red-50 text-red-700":b.status==="rescheduled"?"bg-amber-50 text-amber-800":"bg-emerald-50 text-emerald-800")}>{t(b.status)}</span>{b.call_outcome && b.call_outcome!=="pending" && <span className={badge+" "+({completed:"bg-emerald-50 text-emerald-800",missed:"bg-amber-50 text-amber-800",postponed:"bg-blue-50 text-blue-800",no_show:"bg-red-50 text-red-700"}[b.call_outcome] || "bg-secondary")}>{t("admin_call_"+b.call_outcome)}</span>}<span className={badge+" "+(b.wix_sync_status==="synced"?"bg-emerald-50 text-emerald-800":"bg-amber-50 text-amber-800")}>{t(b.wix_sync_status==="synced"?"wix_synced":"wix_pending")}</span>{b.google_calendar_events?.length>0 && <span className={badge+" "+(b.calendar_sync_status==="synced"?"bg-emerald-50 text-emerald-800":"bg-amber-50 text-amber-800")}>{t("google_sync_label")} : {b.google_calendar_events.filter(c=>c.status==="synced").length}/{b.google_calendar_events.length}</span>}{b.source==="admin" && <span className={badge+" border text-muted-foreground"}>{t("booking_admin_created")}</span>}</div>
            <div><h2 className="font-heading text-lg break-words">{b.booking_type_name}</h2><p className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground"><CalendarDays className="w-4 h-4" aria-hidden="true"/>{format(b,{weekday:"long",day:"numeric",month:"long",year:"numeric"})}{b.duration ? " · "+b.duration+" min":""} · {b.timezone || "UTC"}</p></div>
            <div className="rounded-xl border bg-background/50 p-3 flex gap-3 min-w-0"><div className="rounded-full bg-secondary w-9 h-9 shrink-0 flex items-center justify-center"><UserRound className="w-4 h-4" aria-hidden="true"/></div><div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">{t("booking_client")}</p><p className="font-medium break-words">{b.name}{b.company && <span className="font-normal text-muted-foreground"> · {b.company}</span>}</p><div className="flex flex-wrap gap-x-4 gap-y-2 mt-2 text-sm"><a className="inline-flex items-center gap-2 min-w-0 hover:underline" href={"mailto:"+encodeURIComponent(b.email)}><Mail className="w-3.5 h-3.5 shrink-0" aria-hidden="true"/><span className="break-all">{b.email}</span></a>{b.phone && <a className="inline-flex items-center gap-2 hover:underline" href={"tel:"+b.phone.replace(/[^+0-9]/g,"")}><Phone className="w-3.5 h-3.5" aria-hidden="true"/>{b.phone}</a>}</div>{b.contact_id && <Link className="inline-block mt-2 text-sm text-primary underline" to={"/admin/contacts?contact="+encodeURIComponent(b.contact_id)}>{t("booking_open_client")}</Link>}</div></div>
            {b.google_calendar_events?.length>0 && b.calendar_sync_status!=="synced" && <div><button disabled={!!retrying} onClick={()=>retryCalendar(b.id)} className="border rounded-xl px-3 py-2 text-sm">{t(retrying===b.id?"loading":"calendar_retry")}</button>{retryError===b.id && <p role="alert" className="text-sm text-amber-800">{t("calendar_sync_failed")}</p>}</div>}
            <div className="flex flex-wrap items-center gap-3"><button onClick={()=>{setFeedback("");setEditing(b);}} className="rounded-xl border px-4 py-2 text-sm font-medium">{t("admin_booking_manage")}</button>{b.deletion_pending && <span className="text-sm text-destructive">{t("admin_booking_pending")}</span>}{b.calendar_sync_status==="skipped" && <span className="text-sm text-muted-foreground">{t("admin_booking_skipped")}</span>}</div>
            {b.external_sync_status?.startsWith("external_sync_") && <p role="alert" className="text-sm text-amber-800">{t(b.external_sync_status)}</p>}
            {b.external_sync_status==="external_sync_conflict" && observed.length>0 && <div className="text-sm space-y-1">{observed.map(({ref,state})=><p key={ref.calendar_id}>{ref.calendar_id} : {state.status==="cancelled"?t("cancelled"):format({...b,start_at:state.start_at},{dateStyle:"medium",timeStyle:"short"})}</p>)}</div>}
            {b.external_checked_at && <p className="text-xs text-muted-foreground">{locale==="fr"?"Dernière vérification Google":"Last Google check"} : {format({...b,start_at:b.external_checked_at},{dateStyle:"short",timeStyle:"medium"})}</p>}
            {b.external_sync_status==="imported" && <p className="text-xs text-muted-foreground">{t("external_sync_imported")}</p>}
            {b.topic && <p className="text-sm whitespace-pre-wrap break-words">{b.topic}</p>}
            {b.meeting_url && /^https?:\/\//.test(b.meeting_url) && <a className="inline-flex items-center gap-2 text-sm text-primary font-medium" href={b.meeting_url} target="_blank" rel="noopener noreferrer"><Video className="w-4 h-4" aria-hidden="true"/>{t("join_meeting")}</a>}
          </div>
        </div>
        <details className="border-t px-4 sm:px-5 py-3"><summary className="cursor-pointer text-sm text-muted-foreground">{t("booking_notifications")} · {t(b.notify_email===false?"disabled":attention?"booking_attention":"booking_details")}</summary><div className="flex flex-wrap gap-2 mt-3">{["confirmation","reminder_24h","reminder_1h",...(b.status==="rescheduled"?["rescheduled"]:[]),...(b.status==="cancelled"?["cancelled"]:[])].map(k=>{const matching=currentLogs.filter(l=>l.email_type===k);const log=matching.find(l=>l.status==="sent") || matching[0];return <span key={k} className={badge+" bg-secondary"}>{t(k)} : {t(b.notify_email===false?"disabled":log?.status || "not_sent")}</span>;})}<span className={badge+" bg-secondary"}>SMS : {t(b.notify_sms?(b.sms_status==="accepted"?"sms_accepted":b.sms_status || "pending"):"disabled")}</span></div>{attention && <p className="text-sm text-amber-800 mt-3">{t("booking_notification_issue")}</p>}</details>
      </article>;
    })}
  </div>;
}
