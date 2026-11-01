import CreateBookingButton from "./CreateBookingButton";
import DashboardCalendarView from "./DashboardCalendarView";
import CurrentAppointmentBanner from "./CurrentAppointmentBanner";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api/client";
import { useI18n } from "@/i18n/I18nContext";
import { CalendarDays, LayoutGrid } from "lucide-react";

async function all(entity) {
  const rows = [];
  for (let offset = 0; ; offset += 100) {
    const page = await entity.filter({}, "-created_date", 100, offset);
    rows.push(...page);
    if (page.length < 100) return rows;
  }
}
export default function DashboardTab() {
  const { t, locale } = useI18n();
  const [data, setData] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState(false);
  const [view, setView] = useState("overview");
  async function load() {
    setLoading(true); setError(false);
    try {
      const [bookings, contacts, pages, logs, settings] = await Promise.all(
        ["Booking", "Contact", "BookingPage", "EmailLog", "Setting"].map(name => all(api.entities[name]))
      );
      setData({ bookings, contacts, pages, logs, settings });
    } catch { setError(true); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  const now = Date.now();
  const activeBookings = (data?.bookings || []).filter(b => ["confirmed", "rescheduled"].includes(b.status));
  const current = activeBookings.filter(b => Date.parse(b.start_at) <= now && Date.parse(b.end_at) > now).sort((a,b) => Date.parse(b.start_at) - Date.parse(a.start_at))[0] || null;
  const upcoming = activeBookings.filter(b => Date.parse(b.start_at) > now).sort((a,b) => Date.parse(a.start_at) - Date.parse(b.start_at));
  const week = [...(current ? [current] : []), ...upcoming].filter(b => Date.parse(b.start_at) < now + 7 * 86400000);
  const timezone = data?.settings.find(s => s.key === "reference_timezone")?.value || "UTC";
  function date(value, options={dateStyle:"medium",timeStyle:"short"}) {
    try { return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {...options,timeZone:timezone}).format(new Date(value)); }
    catch { return "—"; }
  }
  const issues = (data?.logs || []).filter(l => ["failed","pending_configuration","review_required"].includes(l.status) && !data.logs.some(other => other.dedupe_key === l.dedupe_key && other.status === "sent"));
  const latestIssues = [...new Map(issues.map(l => [l.dedupe_key, l])).values()];
  const cards = data ? [
    ["dash_week", week.length, "bookings"],
    ["dash_upcoming", upcoming.length, "bookings"],
    ["crm_contacts", data.contacts.filter(c => !c.merged_into).length, "contacts"],
    ["dash_public_pages", data.pages.filter(p => { try { return p.status === "published" && JSON.parse(p.published_json).active; } catch { return false; } }).length, "my-page"]
  ] : [];
  return <div className="space-y-8"><div className="flex flex-wrap items-center justify-end gap-2"><Link to="/admin/links" className="inline-flex items-center rounded-xl border px-4 py-2 text-sm hover:bg-secondary">{t("tab_links")}</Link><CreateBookingButton onCreated={load} /></div>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="font-heading text-3xl">{t("pages_dashboard")}</h1><p className="text-muted-foreground mt-2">{t("dash_intro")}</p></div><div className="flex flex-wrap items-center gap-2"><div className="inline-flex rounded-xl border bg-card p-1" role="group" aria-label={t("dashboard_view")}><button type="button" aria-pressed={view==="overview"} onClick={()=>setView("overview")} className={"min-h-11 rounded-lg px-3 inline-flex items-center gap-2 text-sm "+(view==="overview"?"bg-secondary font-medium":"")}><LayoutGrid className="w-4 h-4" aria-hidden="true"/>{t("dashboard_overview")}</button><button type="button" aria-pressed={view==="calendar"} onClick={()=>setView("calendar")} className={"min-h-11 rounded-lg px-3 inline-flex items-center gap-2 text-sm "+(view==="calendar"?"bg-secondary font-medium":"")}><CalendarDays className="w-4 h-4" aria-hidden="true"/>{t("dashboard_calendar")}</button></div><button onClick={load} disabled={loading} className="min-h-11 border rounded-xl px-4 py-2 disabled:opacity-50">{t("refresh")}</button></div></div>
    {!loading && !error && current && <CurrentAppointmentBanner booking={current} timezone={timezone} locale={locale} t={t}/>}
    {loading ? <p role="status">{t("loading")}</p> : error ? <p role="alert">{t("load_error")}</p> : view==="calendar" ? <DashboardCalendarView bookings={data.bookings} timezone={timezone} locale={locale} t={t}/> : <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{cards.map(([label,value,target]) => <Link key={label} to={"/admin/"+target} className="bg-card border rounded-2xl p-5 hover:border-primary transition-colors"><p className="text-sm text-muted-foreground">{t(label)}</p><p className="font-heading text-4xl mt-3">{value}</p></Link>)}</div>
      <div className="grid grid-cols-1 lg:grid-cols-3 items-start gap-5">
        <section className="lg:col-span-2 border bg-card rounded-2xl p-5 min-w-0"><div className="flex flex-wrap justify-between gap-3 mb-5"><h2 className="font-heading text-xl">{t("dash_next")}</h2><Link className="text-sm underline" to="/admin/bookings">{t("dash_all_bookings")}</Link></div><p className="text-xs text-muted-foreground mb-4">{timezone}</p>
        {!upcoming.length ? <p className="text-muted-foreground py-4">{t("no_upcoming")}</p> : <ul className="space-y-3">{upcoming.slice(0,5).map(b => {
          const context=b.context_key || (["general","personal","personnel"].includes(b.context)?b.context:"general");
          const tone=({general:"bg-primary/10 text-primary",personal:"bg-violet-100 text-violet-800",personnel:"bg-violet-100 text-violet-800"})[context] || "bg-secondary text-foreground";
          return <li key={b.id} className="rounded-xl border p-3 sm:p-4 flex gap-3 sm:gap-4 min-w-0">
            <div className="shrink-0 w-16 sm:w-20 rounded-xl bg-secondary/60 px-2 py-3 text-center self-start"><p className="text-xs uppercase">{date(b.start_at,{month:"short"})}</p><p className="font-heading text-2xl leading-tight">{date(b.start_at,{day:"2-digit"})}</p><p className="text-sm font-semibold mt-1">{date(b.start_at,{hour:"2-digit",minute:"2-digit"})}</p></div>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap gap-1.5 mb-2"><span className={"rounded-full px-2 py-0.5 text-xs font-medium "+tone}>{context==="general"?t("general"):["personal","personnel"].includes(context)?t("booking_personal"):context.toUpperCase()}</span><span className={"rounded-full px-2 py-0.5 text-xs "+(b.status==="rescheduled"?"bg-amber-50 text-amber-800":"bg-emerald-50 text-emerald-800")}>{t(b.status)}</span></div>
            <p className="font-heading font-semibold break-words">{b.name}</p>{b.company && <p className="text-xs text-muted-foreground break-words">{b.company}</p>}<p className="text-sm mt-1 break-words">{b.booking_type_name}{b.duration ? " · "+b.duration+" min":""}</p>
            <p className="text-xs text-muted-foreground mt-1">{date(b.start_at,{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</p>
            <div className="flex flex-wrap items-center gap-2 mt-3 text-xs"><Link className="min-h-11 inline-flex items-center rounded-xl border px-3 text-foreground font-medium hover:bg-secondary/60 transition-colors" to={"/admin/bookings?booking="+encodeURIComponent(b.id)}>{t("booking_shortcut")}</Link>{b.contact_id && <Link className="min-h-11 inline-flex items-center text-primary underline" to={"/admin/contacts?contact="+encodeURIComponent(b.contact_id)}>{t("booking_open_client")}</Link>}{b.meeting_url && /^https?:\/\//.test(b.meeting_url) && <a className="min-h-11 inline-flex items-center text-primary underline" href={b.meeting_url} target="_blank" rel="noopener noreferrer">{t("join_meeting")}</a>}</div></div>
          </li>;
        })}</ul>}</section>
        <section className="border bg-card rounded-2xl p-5 min-w-0 space-y-4"><h2 className="font-heading text-xl">{t("dash_attention")}</h2><p className="font-heading text-4xl">{latestIssues.length}</p><p className="text-sm text-muted-foreground">{t(latestIssues.length ? "dash_email_issues" : "dash_no_email_issues")}</p>
        <div className="pt-4 border-t space-y-3">{[["contacts","crm_contacts"],["my-page","my_page"],["availability","tab_availability"]].map(([target,key]) => <Link key={target} to={"/admin/"+target} className="block text-sm hover:underline">{t(key)} →</Link>)}</div></section>
      </div>
    </>}
  </div>;
}
