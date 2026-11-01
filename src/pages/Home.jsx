import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { getAvailability } from "@/api/bookingFunctions";
import { createBooking } from "@/api/bookingFunctions";
import BookingTypeCard from "@/components/booking/BookingTypeCard";
import DayStrip from "@/components/booking/DayStrip";
import SlotGrid from "@/components/booking/SlotGrid";
import BookingForm from "@/components/booking/BookingForm";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useI18n } from "@/i18n/I18nContext";

import { Github, Loader2 } from "lucide-react";
import TimezonePicker from "@/components/booking/TimezonePicker";
import { initialTimezone, rememberTimezone, validZone, visitorDays, utcOffset } from "@/lib/visitorTimezone";

export default function Home() {
  const { slug, pageSlug, previewId } = useParams();
  const [page,setPage] = useState(null);
  const [initError,setInitError] = useState("");
  const navigate = useNavigate();
  const { t, locale, setLocale } = useI18n();
  const [timezone, setTimezone] = useState(initialTimezone);
  function changeTimezone(zone) {
    if (!validZone(zone)) return;
    setSelectedSlot(null); setSelectedDate(null); setAvailability(null); setSubmitError(null);
    setTimezone(zone); rememberTimezone(zone);
  }
  const [types, setTypes] = useState([]);
  const [link, setLink] = useState(null);
  const contextKey = page?.context_key || "general";
  const copy = key => page?.[key+"_"+locale] || "";
  const [selectedType, setSelectedType] = useState(null);
  const [availability, setAvailability] = useState(null);
  const [availabilityError,setAvailabilityError]=useState(false),[refreshTick,setRefreshTick]=useState(0);
  const lastAvailabilityCheck=useRef(0);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [daysCount, setDaysCount] = useState(14);
  const [loadingInit, setLoadingInit] = useState(true);

  useEffect(() => {
    let active=true;
    setLoadingInit(true);setInitError("");setPage(null);setSelectedType(null);setSelectedSlot(null);setAvailability(null);setLink(null);
    (async () => {
      try {
        let invitation=null;
        if(slug)invitation=(await api.functions.invoke("resolveBookingLink",{slug})).data.link;
        const args=previewId?{preview_id:previewId}:invitation?.booking_page_id?{id:invitation.booking_page_id}:{slug:pageSlug || (invitation?.booking_context==="general"?"/":invitation?.booking_context) || "/"};
        const {data}=await api.functions.invoke("resolveBookingPage",args);
        if(!active)return;
        if(invitation?.booking_type_id && !data.types.some(t=>t.id===invitation.booking_type_id))throw Error("pages_unavailable");
        setPage(data.page);setTypes(data.types);setLink(invitation);
        const requested=new URLSearchParams(window.location.search).get("lang");
        const forced=data.page.language_mode!=="auto"?data.page.language_mode:null;
        if(forced || ["en","fr"].includes(requested) || invitation?.locale)setLocale(forced || requested || invitation.locale);
        setSelectedType(data.types.find(t=>t.id===(invitation?.booking_type_id || data.page.default_booking_type_id)) || null);
      } catch {if(active)setInitError("pages_unavailable");}
      finally {if(active)setLoadingInit(false);}
    })();
    return()=>{active=false;};
  },[slug,pageSlug,previewId,setLocale]);

  useEffect(()=>{
    if(!page)return;
    const oldTitle=document.title,oldLang=document.documentElement.lang;
    let meta=/** @type {HTMLMetaElement | null} */ (document.querySelector('meta[name="description"]')),created=!meta;
    if(!meta){meta=document.createElement("meta");meta.name="description";document.head.append(meta);}
    const previous=meta.content;
    document.title=page["meta_title_"+locale] || page["headline_"+locale] || page.name;
    document.documentElement.lang=locale;meta.content=page["meta_description_"+locale] || "";
    return()=>{document.title=oldTitle;document.documentElement.lang=oldLang;if(created)meta.remove();else meta.content=previous;};
  },[page,locale]);

  useEffect(()=>{
    if(!selectedType)return;
    const refresh=()=>{if(!document.hidden && Date.now()-lastAvailabilityCheck.current>=60000){lastAvailabilityCheck.current=Date.now();setRefreshTick(v=>v+1);}};
    const timer=setInterval(refresh,60000);
    window.addEventListener("focus",refresh);document.addEventListener("visibilitychange",refresh);
    return()=>{clearInterval(timer);window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",refresh);};
  },[selectedType]);
  useEffect(() => {
    if (!selectedType) return;
    let active=true;
    lastAvailabilityCheck.current=Date.now();setLoadingAvail(true);setAvailabilityError(false);
    getAvailability({ booking_type_id: selectedType.id, timezone, days: daysCount, locale })
      .then((res) => {
        if(!active)return;
        const days = visitorDays(res.data.days, timezone, locale);
        setAvailability({...res.data, days});
        const first=days.find(d=>d.slots.length>0);
        setSelectedDate(previous=>days.some(d=>d.date===previous)?previous:first?.date || days[0]?.date || null);
        setSelectedSlot(previous=>previous && days.some(d=>d.slots.some(s=>s.start_at===previous.start_at && s.end_at===previous.end_at))?previous:null);
      })
      .catch(() => {if(active){setAvailability(null);setSelectedSlot(null);setAvailabilityError(true);}})
      .finally(() => {if(active)setLoadingAvail(false);});
    return()=>{active=false;};
  }, [selectedType, timezone, daysCount, locale, refreshTick]);
  useEffect(()=>{setSelectedSlot(null);setAvailability(null);},[selectedType,timezone]);

  const loadMore = () => setDaysCount(30);

  const handleSubmit = async ({ name, email, phone, company, context }) => {
    if(previewId){setSubmitError(t("pages_preview_notice"));return;}
    if (!selectedSlot || loadingAvail || submitting || !availability || availability.timezone !== timezone) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await createBooking({
        booking_type_id: selectedType.id,
        booking_page_id: page.id,
        start_at: selectedSlot.start_at,
        end_at: selectedSlot.end_at,
        name, email, phone, company,
        context: contextKey,
        topic: context || link?.context || "",
        timezone,
        locale,
        booking_link_id: link?.id || "",
        source: link?.slug || page.slug,
      });
      navigate(`/confirmed?b=${res.data.booking.reschedule_token}`);
    } catch (e) {
      const message = e.response?.data?.error || e.message || "crm_error";
      setSubmitError((message.startsWith("crm_") || message.startsWith("pages_")) ? t(message) : message);
    } finally {
      setSubmitting(false);
    }
  };

  const currentDay = availability?.days.find((d) => d.date === selectedDate);
  const tzLabel = availability?.timezoneLabel || timezone;
  const timezoneReference = currentDay?.slots[0]?.start_at || (selectedDate ? selectedDate + "T12:00:00Z" : undefined);
  const dayOffset = [...new Set((currentDay?.slots || []).map(slot => slot.offset))].filter(Boolean).join(" / ") || utcOffset(timezone, timezoneReference);

  if(loadingInit)return <div className="min-h-screen flex items-center justify-center">{t("loading")}</div>;
  if(initError)return <div className="min-h-screen flex flex-col gap-4 items-center justify-center p-8 text-center"><LanguageSwitcher/><h1 className="text-xl">{locale === "fr" ? "La réservation n’est pas disponible pour le moment." : "Booking is currently unavailable."}</h1><p className="text-sm text-muted-foreground max-w-md">{locale === "fr" ? "La page n’est peut-être pas encore configurée, ou elle est temporairement indisponible. Réessayez un peu plus tard." : "This page may not be configured yet, or may be temporarily unavailable. Please try again later."}</p><a href="/admin/setup" className="min-h-11 inline-flex items-center rounded-xl border px-4 text-sm">{locale === "fr" ? "Vous gérez ce site ? Configurer la réservation" : "Manage this site? Set up booking"}</a></div>;
  const githubUrl=page?.slug==="/" && /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(page?.github_repo_url || "") ? page.github_repo_url : "";
  const accent={terracotta:"18 43% 43%",sage:"151 24% 33%",blue:"209 38% 39%",plum:"290 23% 39%"}[page?.accent_style];
  return (
    <div style={/** @type {import("react").CSSProperties} */ ({"--primary":accent})} className="min-h-screen bg-background flex flex-col items-center">
      {availabilityError && <p role="alert" className="p-4 text-destructive">{locale==="fr"?"Impossible de vérifier les agendas. Les créneaux seront réactualisés automatiquement.":"Unable to check calendars. Availability will refresh automatically."}</p>}
      {/* Top bar */}
      <header className="w-full min-w-0 max-w-[1080px] px-4 sm:px-8 py-6 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4">
          {page?.logo_url ? <img src={page.logo_url} alt="" className="h-8 w-auto max-w-24 object-contain"/> : <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>}
          {page?.context_icon && <span>{page.context_icon}</span>}
          <span className="font-heading text-sm font-semibold text-foreground tracking-tight">
            {page?.brand_label}
          </span>
        </a>
        {page?.language_mode === "auto" && <LanguageSwitcher />}
      </header>

      {/* Hero */}
      <section className="w-full min-w-0 max-w-[1080px] px-4 sm:px-8 pt-4 pb-10 sm:pt-8 sm:pb-14 text-center sm:text-left">
        {copy("eyebrow").trim() && <span className="inline-flex items-center text-xs font-heading font-medium text-primary bg-primary/10 px-3 py-1 rounded-full mb-5">
          {copy("eyebrow")}
        </span>}
        <h1 className="text-display text-foreground">{copy("headline")}</h1>
        <p className="text-base text-muted-foreground mt-4 max-w-md mx-auto sm:mx-0 leading-relaxed">
          {copy("subtitle")}
        </p>
        {copy("intro_text") && <p className="whitespace-pre-line text-muted-foreground max-w-2xl mt-5">{copy("intro_text")}</p>}
        {page?.hero_visual_url && <img src={page.hero_visual_url} alt="" className="mt-6 w-full max-h-64 object-cover rounded-2xl"/>}
      </section>

      {/* Main */}
      <main className="w-full min-w-0 max-w-[1080px] px-4 sm:px-8 pb-20">
        <div className="grid min-w-0 grid-cols-1 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] gap-6 lg:gap-8 items-start">
          {/* LEFT — types */}
          <section className="min-w-0">
            {link && (
              <div className="mb-6 p-4 rounded-2xl bg-secondary/60 border border-border/50 animate-fade-in">
                <div className="text-xs font-heading font-medium text-emerald mb-1.5">{t("contextual_link")}</div>
                {link.title && <div className="font-heading text-base font-semibold text-foreground">{link.title}</div>}
                {link.context && <p className="text-sm text-muted-foreground mt-1">{link.context}</p>}
                {link.company && <p className="text-xs text-muted-foreground/80 mt-1.5">{link.company}</p>}
              </div>
            )}

            <div className="text-xs font-heading font-medium text-muted-foreground/80 mb-4 tracking-[0.14em] uppercase">{t("meeting_type")}</div>
            {loadingInit ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> {t("loading")}</div>
            ) : types.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("no_types")}</p>
            ) : (
              <div className="space-y-3">
                {types.map((tp) => (
                  <BookingTypeCard key={tp.id} type={tp} selected={selectedType?.id === tp.id} onSelect={setSelectedType} />
                ))}
              </div>
            )}
          </section>

          {/* RIGHT — availability */}
          <section className="min-w-0">
            {!selectedType ? (
              <div className="min-h-[240px] sm:min-h-[340px] flex items-center justify-center rounded-3xl bg-card/60 border border-border/40 p-8 text-center">
                <div>
                  <div className="text-xs font-heading font-medium text-muted-foreground/80 mb-2 tracking-[0.14em] uppercase">{t("availability")}</div>
                  <p className="text-sm text-muted-foreground max-w-xs">{copy("secondary_copy")}</p>
                </div>
              </div>
            ) : loadingAvail && !availability ? (
              <div className="min-h-[240px] sm:min-h-[340px] flex items-center justify-center rounded-3xl bg-card/60 border border-border/40">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="w-full min-w-0 rounded-3xl bg-card shadow-soft border border-border/40 p-4 sm:p-6">
                <div className="text-xs font-heading font-medium text-muted-foreground/80 mb-4 tracking-[0.14em] uppercase">{t("pick_day")}</div>
                <DayStrip
                  days={availability?.days || []}
                  selectedDate={selectedDate}
                  onSelect={(d) => { setSelectedDate(d.date); setSelectedSlot(null); }}
                  onMoreDates={daysCount < 30 ? loadMore : null}
                />
                <div className="mt-7 pt-6 border-t border-border/50">
                  <div className="flex items-start justify-between gap-3 text-xs font-heading font-medium text-muted-foreground/80 mb-4 uppercase">
                    <span className="tracking-[0.14em]">{currentDay ? `${currentDay.dayLabel} ${currentDay.dayNumber} · ${t("available_times")}` : ""}</span>
                    {currentDay && <span className="shrink-0 whitespace-nowrap">{dayOffset}</span>}
                  </div>
                  <SlotGrid
                    slots={currentDay?.slots || []}
                    selectedSlot={selectedSlot}
                    onSelect={setSelectedSlot}
                  />
                </div>
                {selectedSlot && (
                  <BookingForm
                    ctaLabel={copy("primary_cta")}
                    disabled={!!previewId || loadingAvail}
                    defaultName={link?.contact_name || ""}
                    defaultEmail={link?.contact_email || ""}
                    defaultPhone={link?.contact_phone || ""}
                    defaultContext={link?.context || ""}
                    defaultCompany={link?.company || ""}
                    onSubmit={handleSubmit}
                    submitting={submitting}
                    error={submitError}
                  />
                )}
              </div>
            )}
          </section>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-3 gap-y-0">
          <p className="text-xs text-muted-foreground/70">{t("times_in_tz", { tz: tzLabel })}</p>
          <TimezonePicker value={timezone} onChange={changeTimezone} locale={locale} disabled={submitting} referenceDate={timezoneReference}/>
        </div>
        {copy("footer_text") && <p className="text-center text-xs text-muted-foreground mt-4 whitespace-pre-line">{copy("footer_text")}</p>}
        {githubUrl && <footer className="mt-6 flex justify-center"><a href={githubUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Github className="h-4 w-4" aria-hidden="true"/>{locale==="fr"?"Code source sur GitHub":"Source code on GitHub"}</a></footer>}
      </main>
    </div>
  );
}
