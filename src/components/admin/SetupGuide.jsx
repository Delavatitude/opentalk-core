import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api/client";
import { useI18n } from "@/i18n/I18nContext";
import { setupStatus, validTimezone, validPublicUrl } from "@/lib/setupStatus";
import BookingTypesTab from "./BookingTypesTab";
import AvailabilityTab from "./AvailabilityTab";
import PagesTab from "./PagesTab";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Loader2, RefreshCw } from "lucide-react";

const input = "w-full min-h-11 rounded-xl border bg-background px-3 py-2 text-sm";
const button = "min-h-11 rounded-xl border px-4 py-2 text-sm inline-flex items-center justify-center gap-2 hover:bg-secondary disabled:opacity-50";

export async function loadSetup() {
  async function rows(name) {
    const result = [];
    for (let skip = 0; ; skip += 100) {
      const page = await api.entities[name].filter({}, "-created_date", 100, skip);
      result.push(...page);
      if (page.length < 100) return result;
    }
  }
  const [settings, types, rules, pages] = await Promise.all(["Setting", "BookingType", "AvailabilityRule", "BookingPage"].map(rows));
  return { settings, types, rules, pages };
}

export default function SetupGuide({ data, refresh, onCompleted }) {
  const { locale } = useI18n();
  const fr = locale === "fr", copy = (a, b) => fr ? a : b;
  const state = setupStatus(data);
  const [step, setStep] = useState(state.ready ? 4 : state.next);
  const [visitedSteps, setVisitedSteps] = useState(() => ({[state.ready ? 4 : state.next]:true}));
  const [pageEditorVisited, setPageEditorVisited] = useState(false);
  useEffect(() => { setVisitedSteps(previous => previous[step] ? previous : {...previous,[step]:true}); }, [step]);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [error, setError] = useState("");
  const [probe, setProbe] = useState(null), [editingPage, setEditingPage] = useState(false);
  const [form, setForm] = useState({ brand_name: state.values.brand_name || "", reference_timezone: state.values.reference_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", app_base_url: state.values.app_base_url || "" });
  const [pageName, setPageName] = useState(state.root?.brand_label || state.values.brand_name || "");
  const labels = [
    copy("Votre activité", "Your business"),
    copy("Vos rendez-vous", "Appointment types"),
    copy("Vos horaires", "Your hours"),
    copy("Votre page", "Your booking page"),
    copy("Vérifier et partager", "Check and share"),
  ];
  useEffect(() => { setProbe(null); setError(""); setMessage(""); }, [step]);
  async function run(action) {
    setBusy(true); setMessage(""); setError("");
    try { await action(); } catch { setError(copy("Impossible d’enregistrer ou de vérifier. Réessayez ; les étapes déjà enregistrées sont conservées.", "Unable to save or verify. Retry; previously saved steps are kept.")); }
    finally { setBusy(false); }
  }
  async function saveBasics(event) {
    event.preventDefault();
    if (!form.brand_name.trim() || !validTimezone(form.reference_timezone) || !validPublicUrl(form.app_base_url)) {
      setError(copy("Renseignez un nom, un fuseau valide et l’adresse de votre site (HTTPS, ou localhost en local, sans chemin).", "Enter a name, a valid timezone and your site address (HTTPS, or localhost for local use, without a path).")); return;
    }
    await run(async () => {
      for (const [key, raw] of Object.entries(form)) {
        const value = raw.trim().replace(key === "app_base_url" ? /\/$/ : /$^/, "");
        const existing = data.settings.find(s => s.key === key);
        if (existing) await api.entities.Setting.update(existing.id, { value });
        else await api.entities.Setting.create({ key, value });
      }
      setPageName(form.brand_name.trim());
      await refresh(); setStep(1);
    });
  }
  async function next() {
    await run(async () => {
      const updated = setupStatus(await refresh());
      if (step < 4 && !updated.steps[step]) { setError(copy("Terminez cette étape et enregistrez vos modifications avant de continuer.", "Complete this step and save your changes before continuing.")); return; }
      setStep(Math.min(4, step + 1));
    });
  }
  async function publishStarter(event) {
    event.preventDefault();
    if (!pageName.trim()) return;
    await run(async () => {
      const old = data.pages.find(p => p.slug === "/" || p.published_slug === "/");
      const page = {
        ...(old || {}), name: pageName.trim(), brand_label: pageName.trim(), slug: "/", context_key: old?.context_key || "general",
        active: true, language_mode: old?.language_mode || "auto", accent_style: old?.accent_style || "terracotta",
        booking_type_ids: state.activeTypes.map(t => t.id), default_booking_type_id: state.activeTypes[0]?.id || "", type_overrides: old?.type_overrides || [],
      };
      const defaults = {
        headline_fr: "Prenons rendez-vous.", headline_en: "Let’s book a time.",
        subtitle_fr: "Choisissez le rendez-vous et l’horaire qui vous conviennent.", subtitle_en: "Choose an appointment and a time that work for you.",
        primary_cta_fr: "Confirmer le rendez-vous", primary_cta_en: "Confirm appointment",
        eyebrow_fr: "Réservation en ligne", eyebrow_en: "Online booking",
        secondary_copy_fr: "Choisissez un type de rendez-vous pour voir les créneaux.", secondary_copy_en: "Choose an appointment type to see available times.",
      };
      for (const [key, value] of Object.entries(defaults)) if (!page[key]) page[key] = value;
      const result = await api.functions.invoke("adminPages", { action: "publish", ...(old ? {id: old.id} : {}), page });
      if (!result.data?.page) throw new Error("publish_failed");
      await refresh(); setMessage(copy("Votre page d’accueil est publiée dans l’application.", "Your booking homepage is published in the application."));
    });
  }
  async function checkBooking() {
      setProbe(null);
      const updated = setupStatus(await refresh());
      if (!updated.ready) throw new Error("setup_incomplete");
      const resolved = await api.functions.invoke("resolveBookingPage", { slug: "/" });
      if (!resolved.data?.types?.length) throw new Error("page_missing");
      let slots = 0;
      for (const type of resolved.data.types) {
        const result = await api.functions.invoke("getAvailabilityWithCalendars", { booking_type_id: type.id, timezone: updated.values.reference_timezone, days: 14, locale });
        if (!Array.isArray(result.data?.days)) throw new Error("availability_missing");
        slots += result.data.days.reduce((n, day) => n + (day.slots?.length || 0), 0);
      }
      setProbe({ slots, checkedAt: new Date().toLocaleTimeString(fr ? "fr-FR" : "en-GB") });
      return updated;
  }
  async function verify() { await run(checkBooking); }
  async function finish() {
    await run(async () => {
      await checkBooking();
      const value = new Date().toISOString();
      const existing = (await api.entities.Setting.filter({key:"onboarding_completed_at"}))[0];
      if (existing) await api.entities.Setting.update(existing.id, {value});
      else await api.entities.Setting.create({key:"onboarding_completed_at",value});
      onCompleted?.();
    });
  }
  return <section className="space-y-6">
    <div><p className="text-xs font-semibold uppercase tracking-wider text-primary">{copy("Premiers pas", "Getting started")}</p><h1 className="font-heading text-3xl mt-2">{copy("Configurons votre réservation.", "Let’s set up your booking.")}</h1><p className="text-sm text-muted-foreground mt-2">{copy("Avancez à votre rythme. Chaque réglage enregistré est conservé et vous pouvez revenir à tout moment.", "Go at your own pace. Saved settings are kept and you can return at any time.")}</p></div>
    <div className="rounded-2xl border bg-card p-4"><div className="flex justify-between gap-3 text-sm mb-3"><span>{copy("Configuration nécessaire", "Required configuration")}</span><span>{state.completed}/4</span></div><progress className="w-full h-2 accent-primary" max="4" value={state.completed} aria-label={copy("Progression de la configuration", "Setup progress")} />
    <nav aria-label={copy("Étapes de configuration", "Setup steps")} className="grid grid-cols-1 sm:grid-cols-5 gap-2 mt-4">{labels.map((label, i) => <button key={label} type="button" disabled={busy} aria-current={step === i ? "step" : undefined} onClick={() => setStep(i)} className={"min-h-11 p-3 rounded-xl text-left text-sm inline-flex items-center gap-2 " + (step === i ? "bg-primary/10 text-primary font-semibold" : "hover:bg-secondary")} >{i < 4 && state.steps[i] ? <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true"/> : <Circle className="w-4 h-4 shrink-0" aria-hidden="true"/>}<span>{i + 1}. {label}</span></button>)}</nav></div>
    <div className="rounded-2xl border bg-card p-4 sm:p-6 space-y-5">
      <div><h2 className="font-heading text-xl">{labels[step]}</h2><p className="text-sm text-muted-foreground mt-2">{[
        copy("Indiquez le nom de votre activité, le fuseau de vos horaires et l’adresse finale de votre application.", "Enter your business name, the timezone for your hours and your final application address."),
        copy("Créez au moins un rendez-vous actif. Choisissez sa durée, le délai minimum et le lieu. Google Meet nécessite un agenda connecté ; téléphone, adresse ou lieu personnalisé fonctionnent sans intégration.", "Create at least one active appointment type. Set its duration, minimum notice and location. Google Meet requires a connected calendar; phone, physical and custom locations work without integrations."),
        copy("Définissez au moins une plage horaire active. Les périodes bloquées retirent les créneaux de la réservation.", "Set at least one active working period. Blocked periods remove slots from booking."),
        copy("La page d’accueil doit être publiée et contenir au moins un rendez-vous actif avec des horaires. Vous pouvez démarrer avec un modèle puis personnaliser les textes.", "Your homepage must be published and include an active appointment type with working hours. Start with a template, then customize its content."),
        copy("Vérifiez le chargement de votre page et de ses créneaux avant de partager son adresse. Ce test ne crée aucun rendez-vous.", "Check that your page and available slots load before sharing its address. This check creates no appointment."),
      ][step]}</p></div>
      {step === 0 && <form onSubmit={saveBasics} className="space-y-4 max-w-xl">
        <label className="block text-sm">{copy("Nom de votre activité", "Business name")}<input required maxLength={100} className={input + " mt-1"} value={form.brand_name} onChange={e => setForm({...form,brand_name:e.target.value})}/></label>
        <label className="block text-sm">{copy("Fuseau des horaires", "Working hours timezone")}<input required className={input + " mt-1"} value={form.reference_timezone} placeholder="Europe/Paris" onChange={e => setForm({...form,reference_timezone:e.target.value})}/><span className="block text-xs text-muted-foreground mt-1">{copy("Exemples : Europe/Paris, America/Montreal, UTC.", "Examples: Europe/Paris, America/Montreal, UTC.")}</span></label>
        <label className="block text-sm">{copy("Adresse publique de votre application", "Public application address")}<input required type="url" className={input + " mt-1"} value={form.app_base_url} placeholder="https://booking.example.com" onChange={e => setForm({...form,app_base_url:e.target.value})}/><span className="block text-xs text-muted-foreground mt-1">{copy("Utilisez l’adresse finale indiquée dans OpenTalk ou votre domaine personnalisé. Elle sert aux liens de gestion.", "Use the final address shown in OpenTalk or your custom domain. It is used for booking management links.")}</span></label>
        <button disabled={busy} className={button + " bg-primary text-primary-foreground"}>{copy("Enregistrer et continuer", "Save and continue")}</button>
      </form>}
      <div hidden={step !== 1}>{visitedSteps[1] && <BookingTypesTab/>}</div>
      <div hidden={step !== 2}>{visitedSteps[2] && <AvailabilityTab/>}</div>
      <div hidden={step !== 3}>
        {!state.activeTypes.length ? <button className={button} onClick={() => setStep(1)}>{copy("Créer un rendez-vous d’abord", "Create an appointment type first")}</button> : <form onSubmit={publishStarter} className="space-y-3 max-w-xl">
          <label className="block text-sm">{copy("Nom affiché sur la page", "Name shown on the page")}<input required maxLength={100} className={input + " mt-1"} value={pageName} onChange={e => setPageName(e.target.value)}/></label>
          <p className="text-xs text-muted-foreground">{copy("Le modèle utilise vos rendez-vous actifs. Les textes déjà renseignés sont conservés.", "The template includes your active appointment types. Existing content is preserved.")}</p>
          <button disabled={busy} className={button}>{copy(state.root ? "Mettre à jour la page d’accueil" : "Créer et publier ma page d’accueil", state.root ? "Update my homepage" : "Create and publish my homepage")}</button>
        </form>}
        <button className={button} onClick={() => {setPageEditorVisited(true);setEditingPage(v => !v);}}>{copy("Personnaliser les pages et les textes", "Customize pages and content")}</button><div hidden={!editingPage}>{pageEditorVisited && <PagesTab active={step === 3 && editingPage}/>}</div>
      </div>
      {step === 4 && <div className="space-y-4">
        {!state.ready && <div className="rounded-xl bg-secondary p-4 text-sm"><p>{copy("Il reste des étapes à terminer :", "Complete these steps first:")}</p><div className="flex flex-wrap gap-2 mt-2">{state.steps.map((ok, i) => !ok && <button key={i} className={button} onClick={() => setStep(i)}>{labels[i]}</button>)}</div></div>}
        <button disabled={busy || !state.ready} className={button + " bg-primary text-primary-foreground"} onClick={verify}>{busy && <Loader2 className="w-4 h-4 animate-spin"/>}{copy("Vérifier ma réservation", "Check my booking setup")}</button>
        {probe && <div role="status" className="rounded-xl border p-4 text-sm"><p>{probe.slots > 0 ? copy("Votre page et vos créneaux répondent correctement.", "Your page and available slots respond correctly.") : copy("La page répond, mais aucun créneau n’est disponible sur les 14 prochains jours. Vérifiez les horaires, blocages et délais.", "The page responds, but no slots are available in the next 14 days. Check working hours, blocks and notice periods.")}</p><p className="text-muted-foreground mt-1">{probe.slots} {copy("créneaux · vérifié à", "slots · checked at")} {probe.checkedAt}</p></div>}
        {validPublicUrl(state.values.app_base_url) && <div className="space-y-2"><p className="text-xs text-muted-foreground">{copy("Adresse à partager après publication de l’application dans OpenTalk :", "Address to share after publishing the application in OpenTalk:")}</p><a className="block text-primary underline break-all" href={state.values.app_base_url} target="_blank" rel="noopener noreferrer">{state.values.app_base_url}</a></div>}
        <a href="/" target="_blank" rel="noopener noreferrer" className={button}>{copy("Ouvrir la page de réservation", "Open booking page")}</a>
      </div>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {message && <p role="status" className="text-sm text-primary">{message}</p>}
      <div className="border-t pt-4 flex flex-wrap justify-between gap-3">
        <button disabled={busy || step === 0} className={button} onClick={() => setStep(v => v - 1)}><ArrowLeft className="w-4 h-4"/>{copy("Précédent", "Previous")}</button>
        <button disabled={busy} className={button} onClick={() => run(async () => { await refresh(); setMessage(copy("État actualisé.", "Status refreshed.")); })}><RefreshCw className="w-4 h-4"/>{copy("Actualiser l’état", "Refresh status")}</button>
        {step > 0 && step < 4 && <button disabled={busy} className={button} onClick={next}>{copy("Enregistrer dans le formulaire, puis continuer", "Save in the form, then continue")}<ArrowRight className="w-4 h-4"/></button>}
        {step === 4 && <button type="button" disabled={busy || !state.ready} onClick={finish} className={button + " bg-primary text-primary-foreground"}>{busy ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle2 className="w-4 h-4"/>}{copy("Valider mon lien et terminer", "Validate my booking link and finish")}</button>}
      </div>
    </div>
    <details className="rounded-2xl border p-4"><summary className="cursor-pointer text-sm font-medium">{copy("Options : agendas et notifications", "Optional: calendars and notifications")}</summary><p className="text-sm text-muted-foreground mt-3">{copy("Une réservation avec lieu personnalisé fonctionne sans connexion externe. Connectez un agenda si vous souhaitez importer les indisponibilités et générer les liens Google Meet. Les confirmations email et SMS nécessitent leur propre configuration.", "Bookings with a custom location work without external connections. Connect a calendar to import busy periods and generate Google Meet links. Email and SMS confirmations need their own configuration.")}</p><Link to="/admin/my-page#integrations" className={button + " mt-3"}>{copy("Configurer mes agendas", "Configure calendars")}</Link></details>
  </section>;
}
