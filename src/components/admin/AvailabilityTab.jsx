import { useEffect, useMemo, useState } from "react";
import { api } from "@/api/client";
import { useI18n } from "@/i18n/I18nContext";
import { CalendarDays, CalendarOff, CalendarRange, Clock3, Loader2, Plus, Trash2 } from "lucide-react";

export default function AvailabilityTab() {
  const { t, locale } = useI18n();
  const DAYS = t("days");
  const [rules, setRules] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [savedRules, setSavedRules] = useState([]);
  const [savedTimezone, setSavedTimezone] = useState("UTC");
  const [settings, setSettings] = useState({ reference_timezone: "UTC", app_base_url: "" });
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [custom, setCustom] = useState(() => defaultCustom());

  const load = async () => {
    try {
      const [r, b, s] = await Promise.all([
        api.entities.AvailabilityRule.filter({}),
        api.entities.BlockedPeriod.filter({}),
        api.entities.Setting.filter({}),
      ]);
      setRules(r.sort((a, c) => a.day_of_week - c.day_of_week));
      setSavedRules(r);
      setBlocks(b.sort((a, c) => new Date(a.start_at) - new Date(c.start_at)));
      const map = { reference_timezone: "UTC", app_base_url: "" };
      for (const it of s) map[it.key] = it.value;
      setSettings(map);
      setSavedTimezone(map.reference_timezone);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const addRule = async (day) => {
    if (busyAction) return;
    setBusyAction("add-rule");
    try {
      const rule = await api.entities.AvailabilityRule.create({ day_of_week: day, start_time: "09:00", end_time: "17:00", timezone: savedTimezone, active: true });
      setRules(previous => [...previous, rule]); setSavedRules(previous => [...previous, rule]);
    } catch { setFeedback({type:"error",text:t("load_error")}); }
    finally { setBusyAction(""); }
  };
  const editRule = (id, patch) => setRules(previous => previous.map(rule => rule.id === id ? {...rule,...patch} : rule));
  const updateRule = async (rule) => {
    if (busyAction) return;
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(rule.start_time) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(rule.end_time) || rule.start_time >= rule.end_time) {
      setFeedback({type:"error",text:locale === "fr" ? "L’heure de fin doit être après l’heure de début." : "End time must be after start time."}); return;
    }
    setBusyAction(rule.id); setFeedback(null);
    try {
      await api.entities.AvailabilityRule.update(rule.id, {start_time:rule.start_time,end_time:rule.end_time});
      setSavedRules(previous => previous.map(item => item.id === rule.id ? {...item,start_time:rule.start_time,end_time:rule.end_time} : item));
      setFeedback({type:"success",text:t("saved")});
    } catch { setFeedback({type:"error",text:locale === "fr" ? "Enregistrement impossible. Votre saisie est conservée." : "Unable to save. Your edits are kept."}); }
    finally { setBusyAction(""); }
  };
  const removeRule = async (id) => {
    if (busyAction || !window.confirm(locale === "fr" ? "Supprimer cette plage horaire ?" : "Delete this working period?")) return;
    setBusyAction(id);
    try { await api.entities.AvailabilityRule.delete(id); setRules(previous => previous.filter(r => r.id !== id)); setSavedRules(previous => previous.filter(r => r.id !== id)); }
    catch { setFeedback({type:"error",text:t("load_error")}); }
    finally { setBusyAction(""); }
  };

  const createBlock = async (kind) => {
    const timezone = savedTimezone || "UTC";
    let start;
    let end;
    let allDay = false;
    let reason = custom.reason.trim();

    if (kind === "next24") {
      start = new Date();
      end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      reason = t("block_reason_24h");
    } else if (kind === "todayTomorrow") {
      const today = dateInZone(new Date(), timezone);
      start = zonedLocalToDate(today + "T00:00", timezone);
      end = zonedLocalToDate(addDays(today, 2) + "T00:00", timezone);
      allDay = true;
      reason = t("block_reason_two_days");
    } else if (kind === "thisWeek") {
      const today = dateInZone(new Date(), timezone);
      const weekStart = addDays(today, -daysSinceMonday(today));
      start = zonedLocalToDate(weekStart + "T00:00", timezone);
      end = zonedLocalToDate(addDays(weekStart, 7) + "T00:00", timezone);
      allDay = true;
      reason = t("block_reason_week");
    } else if (kind === "thisMonth") {
      const today = dateInZone(new Date(), timezone);
      const monthStart = today.slice(0, 7) + "-01";
      start = zonedLocalToDate(monthStart + "T00:00", timezone);
      end = zonedLocalToDate(nextMonth(monthStart) + "T00:00", timezone);
      allDay = true;
      reason = t("block_reason_month");
    } else {
      start = zonedLocalToDate(custom.start, timezone);
      end = zonedLocalToDate(custom.end, timezone);
    }

    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      setFeedback({ type: "error", text: t("block_invalid") });
      return;
    }

    setBusyAction(kind);
    setFeedback(null);
    try {
      await api.entities.BlockedPeriod.create({
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        reason,
        all_day: allDay,
      });
      setBlocks((await api.entities.BlockedPeriod.filter({})).sort((a, b) => new Date(a.start_at) - new Date(b.start_at)));
      setCustom(defaultCustom());
      setFeedback({ type: "success", text: t("block_created") });
    } catch {
      setFeedback({ type: "error", text: t("block_failed") });
    } finally {
      setBusyAction("");
    }
  };

  const removeBlock = async (block) => {
    if (!window.confirm(t("delete_block_confirm"))) return;
    setBusyAction(block.id);
    setFeedback(null);
    try {
      await api.entities.BlockedPeriod.delete(block.id);
      setBlocks((await api.entities.BlockedPeriod.filter({})).sort((a, b) => new Date(a.start_at) - new Date(b.start_at)));
      setFeedback({ type: "success", text: t("block_deleted") });
    } catch {
      setFeedback({ type: "error", text: t("block_delete_failed") });
    } finally {
      setBusyAction("");
    }
  };

  const saveSetting = async (key, value) => {
    const existing = (await api.entities.Setting.filter({ key }))[0];
    if (existing) await api.entities.Setting.update(existing.id, { value });
    else await api.entities.Setting.create({ key, value });
    setSettings((p) => ({ ...p, [key]: value }));
  };

  async function saveSettings() {
    if (busyAction) return;
    try { new Intl.DateTimeFormat("en",{timeZone:settings.reference_timezone}); }
    catch { setFeedback({type:"error",text:locale === "fr" ? "Choisissez un fuseau horaire valide." : "Choose a valid timezone."}); return; }
    if (settings.app_base_url) {
      try { const url = new URL(settings.app_base_url); if(url.protocol !== "https:" || url.username || url.password) throw Error(); }
      catch { setFeedback({type:"error",text:locale === "fr" ? "Saisissez une adresse HTTPS valide." : "Enter a valid HTTPS address."}); return; }
    }
    setBusyAction("settings"); setFeedback(null);
    try {
      await saveSetting("reference_timezone", settings.reference_timezone.trim());
      await saveSetting("app_base_url", settings.app_base_url.trim());
      setSavedTimezone(settings.reference_timezone.trim());
      setFeedback({type:"success",text:t("saved")});
    } catch { setFeedback({type:"error",text:locale === "fr" ? "Enregistrement impossible. Votre saisie est conservée." : "Unable to save. Your edits are kept."}); }
    finally { setBusyAction(""); }
  }

  const now = Date.now();
  const currentBlocks = useMemo(
    () => blocks.filter((block) => new Date(block.end_at).getTime() > now),
    [blocks, now]
  );

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-10">
      {feedback && <div role={feedback.type === "error" ? "alert" : "status"} className={"rounded-xl border px-4 py-3 text-sm " + (feedback.type === "error" ? "text-destructive" : "text-primary")}>{feedback.text}</div>}
      <section>
        <div className="text-label text-muted-foreground mb-3">{t("settings")}</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-label text-muted-foreground block mb-1">{t("reference_timezone")}</label>
            <input className={inp} disabled={!!busyAction} value={settings.reference_timezone} onChange={e => setSettings(previous => ({...previous,reference_timezone:e.target.value}))} placeholder="UTC" />
          </div>
          <div>
            <label className="text-label text-muted-foreground block mb-1">{t("app_base_url")}</label>
            <input className={inp} disabled={!!busyAction} value={settings.app_base_url} onChange={e => setSettings(previous => ({...previous,app_base_url:e.target.value}))} placeholder="https://booking.example.com" />
          </div>
        </div>
        <button type="button" disabled={!!busyAction} onClick={saveSettings} className="mt-3 min-h-11 rounded-xl border px-4 text-sm">{busyAction === "settings" ? t("loading") : t("save")}</button>
      </section>

      <section>
        <div className="text-label text-muted-foreground mb-3">{t("weekly_availability")}</div>
        <p className="text-xs text-muted-foreground mb-3">{locale === "fr" ? "Modifiez les heures, puis cliquez sur Enregistrer sur la ligne concernée." : "Edit the hours, then click Save on the relevant row."}</p>
        <div className="space-y-2">
          {DAYS.map((name, dow) => {
            const dayRules = rules.filter((r) => r.day_of_week === dow);
            return (
              <div key={dow} className="border border-border/60 rounded-xl p-3 bg-card/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-foreground font-medium">{name}</span>
                  <button disabled={!!busyAction} onClick={() => addRule(dow)} className="min-w-11 min-h-11 inline-flex items-center justify-center text-muted-foreground hover:text-foreground" aria-label={t("add_availability")}><Plus className="w-4 h-4" /></button>
                </div>
                <div className="space-y-2">
                  {dayRules.map((r) => (
                    <div key={r.id} className="flex flex-wrap items-center gap-2">
                      <input aria-label={t("start")} type="time" disabled={!!busyAction} value={r.start_time} onChange={(e) => editRule(r.id, { start_time: e.target.value })} className={inp} />
                      <span className="text-muted-foreground">→</span>
                      <input aria-label={t("end")} type="time" disabled={!!busyAction} value={r.end_time} onChange={(e) => editRule(r.id, { end_time: e.target.value })} className={inp} />
                      <button type="button" disabled={!!busyAction || savedRules.some(saved => saved.id === r.id && saved.start_time === r.start_time && saved.end_time === r.end_time)} onClick={() => updateRule(r)} className="min-h-11 rounded-xl border px-3 text-sm disabled:opacity-50">{busyAction === r.id ? t("loading") : t("save")}</button>
                      <button disabled={!!busyAction} onClick={() => removeRule(r.id)} className="min-w-11 min-h-11 inline-flex items-center justify-center text-muted-foreground hover:text-coral" aria-label={t("delete")}><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                  {dayRules.length === 0 && <p className="text-xs text-muted-foreground">{t("off")}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-4">
          <div className="text-label text-muted-foreground">{t("blocked_periods")}</div>
          <p className="text-sm text-muted-foreground mt-1">{t("blocked_periods_help", { timezone: savedTimezone })}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <button disabled={Boolean(busyAction)} onClick={() => createBlock("next24")} className={quickButton}>
            {busyAction === "next24" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Clock3 className="w-5 h-5" />}
            <span><strong className="block text-foreground">{t("block_next_24h")}</strong><small className="text-muted-foreground">{t("block_next_24h_help")}</small></span>
          </button>
          <button disabled={Boolean(busyAction)} onClick={() => createBlock("todayTomorrow")} className={quickButton}>
            {busyAction === "todayTomorrow" ? <Loader2 className="w-5 h-5 animate-spin" /> : <CalendarOff className="w-5 h-5" />}
            <span><strong className="block text-foreground">{t("block_today_tomorrow")}</strong><small className="text-muted-foreground">{t("block_today_tomorrow_help")}</small></span>
          </button>
          <button disabled={Boolean(busyAction)} onClick={() => createBlock("thisWeek")} className={quickButton}>
            {busyAction === "thisWeek" ? <Loader2 className="w-5 h-5 animate-spin" /> : <CalendarDays className="w-5 h-5" />}
            <span><strong className="block text-foreground">{t("block_this_week")}</strong><small className="text-muted-foreground">{t("block_this_week_help")}</small></span>
          </button>
          <button disabled={Boolean(busyAction)} onClick={() => createBlock("thisMonth")} className={quickButton}>
            {busyAction === "thisMonth" ? <Loader2 className="w-5 h-5 animate-spin" /> : <CalendarRange className="w-5 h-5" />}
            <span><strong className="block text-foreground">{t("block_this_month")}</strong><small className="text-muted-foreground">{t("block_this_month_help")}</small></span>
          </button>
        </div>

        <div className="border border-border/60 rounded-2xl p-4 bg-card/40 mb-4">
          <div className="font-medium text-sm mb-3">{t("block_custom")}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-label text-muted-foreground">{t("start")}<input type="datetime-local" value={custom.start} onChange={(e) => setCustom((p) => ({ ...p, start: e.target.value }))} className={inp + " block w-full mt-1"} /></label>
            <label className="text-label text-muted-foreground">{t("end")}<input type="datetime-local" value={custom.end} onChange={(e) => setCustom((p) => ({ ...p, end: e.target.value }))} className={inp + " block w-full mt-1"} /></label>
            <label className="text-label text-muted-foreground sm:col-span-2">{t("reason_optional")}<input value={custom.reason} maxLength={120} onChange={(e) => setCustom((p) => ({ ...p, reason: e.target.value }))} className={inp + " block w-full mt-1"} placeholder={t("reason_placeholder")} /></label>
          </div>
          <button disabled={Boolean(busyAction)} onClick={() => createBlock("custom")} className="mt-4 min-h-11 px-4 rounded-xl bg-foreground text-background text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50">
            {busyAction === "custom" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {t("create_block")}
          </button>
        </div>



        <div className="border border-border/60 rounded-2xl divide-y divide-border/60 overflow-hidden">
          {currentBlocks.map((block) => (
            <div key={block.id} className="px-4 py-3 flex items-center justify-between gap-4 bg-card/40">
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">{formatRange(block, savedTimezone, locale)}</div>
                {block.reason && <div className="text-xs text-muted-foreground mt-1 truncate">{block.reason}</div>}
              </div>
              <button disabled={busyAction === block.id} onClick={() => removeBlock(block)} className="shrink-0 min-w-11 min-h-11 inline-flex items-center justify-center text-muted-foreground hover:text-coral disabled:opacity-50" aria-label={t("delete_block")}>
                {busyAction === block.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            </div>
          ))}
          {currentBlocks.length === 0 && <div className="px-4 py-6 text-center text-sm text-muted-foreground">{t("no_blocked")}</div>}
        </div>
      </section>
    </div>
  );
}

const inp = "bg-background border border-border/70 rounded-lg px-2.5 py-2.5 min-h-11 text-sm text-foreground focus:border-primary focus:outline-none";
const quickButton = "min-h-[76px] w-full border border-border/70 rounded-2xl px-4 py-3 text-left flex items-center gap-3 bg-card/40 hover:bg-secondary/60 transition-colors disabled:opacity-50";

function defaultCustom() {
  const start = new Date(Date.now() + 60 * 60 * 1000);
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  return { start: toInput(start), end: toInput(end), reason: "" };
}

function toInput(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function dateInZone(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(dateString, amount) {
  const date = new Date(dateString + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function daysSinceMonday(dateString) {
  const weekday = new Date(dateString + "T12:00:00Z").getUTCDay();
  return (weekday + 6) % 7;
}

function nextMonth(dateString) {
  const [year, month] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month, 1, 12)).toISOString().slice(0, 10);
}

function zonedLocalToDate(localValue, timezone) {
  if (!localValue) return null;
  const [datePart, timePart] = localValue.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, hour12: false, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(guess);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const represented = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour) % 24, Number(values.minute), Number(values.second));
  return new Date(guess.getTime() - (represented - guess.getTime()));
}

function formatRange(block, timezone, locale) {
  const lang = locale === "fr" ? "fr-FR" : "en-US";
  const format = new Intl.DateTimeFormat(lang, {
    timeZone: timezone, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
  return `${format.format(new Date(block.start_at))} → ${format.format(new Date(block.end_at))}`;
}
