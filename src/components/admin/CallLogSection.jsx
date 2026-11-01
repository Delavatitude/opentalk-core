import { useEffect, useState } from "react";
import callNotesStorage from "@/components/admin/callNotesStorage";
import { useI18n } from "@/i18n/I18nContext";
import { Check, Clock, PhoneMissed, UserX, Loader2, Save } from "lucide-react";

const OUTCOMES = [
  { key: "completed", icon: Check, activeClass: "bg-emerald-600 text-white border-emerald-600" },
  { key: "missed", icon: PhoneMissed, activeClass: "bg-amber-600 text-white border-amber-600" },
  { key: "postponed", icon: Clock, activeClass: "bg-blue-600 text-white border-blue-600" },
  { key: "no_show", icon: UserX, activeClass: "bg-coral text-white border-coral" },
];

const textareaCls = "w-full min-h-11 rounded-xl border bg-background p-3 text-sm resize-y focus:border-primary focus:outline-none";

export default function CallLogSection({ booking, onChanged, onBusyChange }) {
  const { t } = useI18n();
  const [outcome, setOutcome] = useState(booking.call_outcome || "pending");
  const [transcript, setTranscript] = useState(booking.call_transcript || "");
  const [summary, setSummary] = useState(booking.call_summary || "");
  const [lastSaved, setLastSaved] = useState({
    outcome: booking.call_outcome || "pending",
    transcript: booking.call_transcript || "",
    summary: booking.call_summary || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(!!booking.call_notes_file_uri);
  const [loadFailed, setLoadFailed] = useState(false);
  useEffect(() => {
    let active = true;
    callNotesStorage.load(booking).then(notes => {
      if (!active) return;
      setTranscript(notes.transcript); setSummary(notes.summary);
      setLastSaved({ outcome: booking.call_outcome || "pending", ...notes });
    }).catch(() => {
      if (active) { setLoadFailed(true); setError("admin_call_load_error"); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [booking.id]);

  const dirty =
    outcome !== lastSaved.outcome ||
    transcript !== lastSaved.transcript ||
    summary !== lastSaved.summary;

  async function save() {
    setBusy(true);
    onBusyChange?.(true);
    setError("");
    setSaved(false);
    let updated;
    try {
      updated = await callNotesStorage.save(booking.id, outcome, transcript, summary);
      setLastSaved({ outcome, transcript, summary });
      setSaved(true);
    } catch (e) {
      setError("admin_call_save_error");
      return;
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
    await onChanged("admin_call_saved", updated);
  }

  return (
    <section className="rounded-xl border bg-background p-4 space-y-4">
      <div>
        <p className="text-sm font-medium">{t("admin_call_section")}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{t("admin_call_section_help")}</p>
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-2">{t("admin_call_outcome")}</p>
        <div className="grid grid-cols-2 gap-2">
          {OUTCOMES.map(({ key, icon: Icon, activeClass }) => (
            <button
              key={key}
              type="button"
              disabled={busy || loading || loadFailed}
              aria-pressed={outcome === key}
              onClick={() => setOutcome(key)}
              className={
                "min-h-11 rounded-xl border px-3 py-2 text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 " +
                (outcome === key ? activeClass + " " : "bg-card hover:bg-secondary/60 ")
              }
            >
              <Icon className="w-4 h-4" /> {t("admin_call_" + key)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-1 block">{t("admin_call_transcript")}</label>
        <textarea
          rows={4}
          disabled={busy || loading || loadFailed}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder={t("admin_call_transcript_help")}
          className={textareaCls}
        />
      </div>

      <div>
        <label className="text-xs text-muted-foreground mb-1 block">{t("admin_call_summary")}</label>
        <textarea
          rows={4}
          disabled={busy || loading || loadFailed}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder={t("admin_call_summary_help")}
          className={textareaCls}
        />
      </div>

      {loading && <p role="status" className="text-sm text-muted-foreground">{t("loading")}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{t(error)}</p>}
      {saved && !dirty && <p role="status" className="text-sm text-primary">{t("admin_call_saved")}</p>}

      <button
        type="button"
        disabled={busy || loading || loadFailed || !dirty}
        onClick={save}
        className="min-h-11 w-full rounded-xl bg-primary text-white text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-40"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {t("admin_call_save")}
      </button>
    </section>
  );
}
