import { useEffect, useState } from "react";
import { api } from "@/api/client";

import { useI18n } from "@/i18n/I18nContext";
import { Loader2, Plus, Trash2, X, CalendarDays } from "lucide-react";

export default function CalendarsTab() {
  const { t, locale } = useI18n();
  const [error,setError]=useState("");
  const [conns, setConns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const [googleCals, setGoogleCals] = useState(null);
  const [loadingCals, setLoadingCals] = useState(false);

  const load = () => {
    setLoading(true);
    api.entities.CalendarConnection.filter({}).then(setConns).catch(()=>setError(locale === "fr" ? "Chargement des agendas impossible." : "Unable to load calendars.")).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openPicker = async () => {
    setPicking(true);
    setLoadingCals(true);
    try {
      setError("");
      const res = await api.functions.invoke("listGoogleCalendars",{});
      setGoogleCals(res.data.calendars);
    } catch (e) {
      setGoogleCals([]);
      setError(locale === "fr" ? "Connectez Google Calendar dans la configuration de votre serveur, puis réessayez. Vérifiez aussi les autorisations du compte." : "Connect Google Calendar in your server configuration, then retry. Check account permissions too.");
    }
    setLoadingCals(false);
  };

  const addCalendar = async (cal) => {
    const exists = conns.some((c) => c.calendar_id === cal.id);
    if (exists) return;
    await api.entities.CalendarConnection.create({
      provider: "google",
      account: "",
      calendar_id: cal.id,
      calendar_name: cal.summary,
      blocks_availability: true,
      creates_events: !!cal.primary,
      active: true,
      color: cal.backgroundColor || "",
    });
    setPicking(false);
    load();
  };

  const update = async (id, patch) => { await api.entities.CalendarConnection.update(id, patch); load(); };
  const remove = async (id) => {
    if (!confirm(t("remove_calendar_confirm"))) return;
    await api.entities.CalendarConnection.delete(id);
    load();
  };

  const googleConnections = conns.filter(c => !c.provider || c.provider === "google");

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-5">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <section aria-labelledby="google-calendar-heading" className="min-w-0 rounded-2xl border border-border/60 bg-card/40 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="flex items-start gap-3 min-w-0">
          <CalendarDays className="w-5 h-5 text-primary mt-1 shrink-0" />
          <div><h2 id="google-calendar-heading" className="font-heading text-lg font-semibold">{t("cal_google")}</h2><p className="text-sm text-muted-foreground mt-1">{t("cal_google_desc")}</p></div>
        </div>
        <span className="text-xs rounded-full bg-secondary px-3 py-1">{t(googleConnections.some(c => c.active) ? "calendar_selection_saved" : "cal_setup")}</span>
      </div>
      <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
        <div className="text-label text-muted-foreground">{t("connected_calendars")}</div>
        <button disabled title={locale === "fr" ? "Connexion aux agendas indisponible dans cette version" : "Calendar connections are unavailable in this version"} onClick={openPicker} className="flex items-center gap-1.5 text-sm text-foreground border border-border/70 rounded-lg px-3 py-1.5 hover:bg-secondary/60 transition-colors">
          <Plus className="w-4 h-4" /> {t("add_calendar")}
        </button>
      </div>

      <div className="border border-border/60 rounded-2xl divide-y divide-border/60 overflow-hidden">
        {googleConnections.map((c) => (
          <div key={c.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/40">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color || "#9A8E7E" }} />
                <span className="text-sm text-foreground font-medium truncate">{c.calendar_name}</span>
                {c.creates_events && <span className="text-label text-emerald border border-emerald/40 px-1.5 py-0.5 rounded-full">{t("calendar_destination")}</span>}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 truncate">{c.calendar_id}</div>
            </div>
            <div className="flex flex-wrap items-center gap-4 shrink-0">
              <Toggle label={t("blocks")} checked={c.blocks_availability} onChange={(v) => update(c.id, { blocks_availability: v })} />
              <Toggle label={t("creates")} checked={c.creates_events} onChange={(v) => update(c.id, { creates_events: v })} />
              <Toggle label={t("active_col")} checked={c.active} onChange={(v) => update(c.id, { active: v })} />
              <button onClick={() => remove(c.id)} className="text-muted-foreground hover:text-coral p-1"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        {googleConnections.length === 0 && <div className="px-4 py-8 text-center text-sm text-muted-foreground">{t("no_calendars")}</div>}
      </div>
      <p className="text-xs text-muted-foreground mt-3">{t("blocks_help")}</p>

      </section>

      {picking && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center p-4 z-50" >
          <div className="bg-card border border-border/70 rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto p-6 shadow-soft-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-lg font-semibold">{t("your_google_calendars")}</h2>
              <button onClick={() => setPicking(false)}><X className="w-5 h-5 text-muted-foreground hover:text-foreground" /></button>
            </div>
            {error && <p role="alert" className="text-sm text-destructive mb-3">{error}</p>}
            {loadingCals ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div> : (
              <div className="space-y-1">
                {(googleCals || []).map((cal) => {
                  const exists = conns.some((c) => c.calendar_id === cal.id);
                  return (
                    <button key={cal.id} disabled={exists} onClick={() => addCalendar(cal)}
                      className="w-full text-left px-3 py-2.5 border border-border/70 rounded-lg hover:border-primary disabled:opacity-30 flex items-center justify-between transition-colors">
                      <span className="text-sm text-foreground">{cal.summary}</span>
                      {cal.primary && <span className="text-label text-emerald">{t("primary")}</span>}
                      {exists && <span className="text-label text-muted-foreground">{t("added")}</span>}
                    </button>
                  );
                })}
                {googleCals && googleCals.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">{t("no_calendars_found")}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <button type="button" role="switch" aria-checked={!!checked} aria-label={label} onClick={() => onChange(!checked)} className="flex items-center gap-1.5 min-h-10">
      <div className={`w-8 h-4 rounded-full border transition-colors relative ${checked ? "bg-emerald border-emerald" : "bg-background border-border"}`}>
        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-foreground transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </div>
      <span className="text-label text-muted-foreground">{label}</span>
    </button>
  );
}
