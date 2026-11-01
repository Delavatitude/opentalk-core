import { cloneElement, useEffect, useId, useState } from "react";
import { api } from "@/api/client";
import { useI18n, localizedField } from "@/i18n/I18nContext";
import { Loader2, Plus, Pencil, Trash2, Info } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { bookingTypeHelp } from "./bookingTypeHelp";

import { CONTEXTS, contextsFor } from "@/lib/bookingContexts";

const EMPTY = {
  contexts: ["general"], reminder_24h: "inherit", reminder_1h: "inherit",
  name: "", name_en: "", name_fr: "", description: "", description_en: "", description_fr: "",
  slug: "", duration: 30, minimum_notice_minutes: 180, buffer_before: 0, buffer_after: 0,
  max_per_day: 8, booking_window_days: 30, brand: "", location_type: "google_meet", location_value: "",
  active: true, sort_order: 0
};

export default function BookingTypesTab() {
  const { t, locale } = useI18n();
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = () => {
    setLoading(true);
    api.entities.BookingType.filter({}).then((tp) => { tp.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)); setTypes(tp); }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const save = async (data) => {
    const payload = {
      ...data,
      name: data.name_en || data.name || data.name_fr,
      description: data.description_en || data.description || data.description_fr,
      slug: data.slug || slugify(data.name_en || data.name || data.name_fr),
    };
    if (editing.id) await api.entities.BookingType.update(editing.id, payload);
    else await api.entities.BookingType.create(payload);
    setEditing(null);
    load();
  };

  const remove = async (id) => {
    if (!confirm(t("delete_type_confirm"))) return;
    await api.entities.BookingType.delete(id);
    load();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-label text-muted-foreground">{t("booking_types")}</div>
        <button onClick={() => setEditing({ ...EMPTY })} className="flex items-center gap-1.5 text-sm text-foreground border border-border/70 rounded-lg px-3 py-1.5 hover:bg-secondary/60 transition-colors">
          <Plus className="w-4 h-4" /> {t("new_type")}
        </button>
      </div>

      <div className="border border-border/60 rounded-2xl divide-y divide-border/60 overflow-hidden">
        {types.map((tp) => (
          <div key={tp.id} className="flex items-center justify-between px-4 py-3 bg-card/40">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground font-medium">{localizedField(tp, "name", locale)}</span>
                {tp.brand && <span className="text-label text-muted-foreground border border-border/70 px-1.5 py-0.5 rounded-full">{tp.brand}</span>}
                {!tp.active && <span className="text-label text-coral">{t("inactive")}</span>}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{tp.duration} min · /{tp.slug} · {t("loc_" + (tp.location_type === "google_meet" ? "google_meet" : tp.location_type === "phone" ? "phone" : tp.location_type === "physical" ? "physical" : "custom"))}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setEditing(tp)} className="text-muted-foreground hover:text-foreground p-1.5"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => remove(tp.id)} className="text-muted-foreground hover:text-coral p-1.5"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        {types.length === 0 && <div className="px-4 py-8 text-center text-sm text-muted-foreground">{t("no_types_admin")}</div>}
      </div>

      {editing && <TypeForm initial={editing} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}

function TypeForm({ initial, onSave, onClose }) {
  const { t, locale } = useI18n();
  const help = key => bookingTypeHelp[key]?.[locale === "fr" ? "fr" : "en"];
  const [f, setF] = useState(initial);
  const [saving, setSaving] = useState(false), [saveError, setSaveError] = useState("");
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  function requestClose() {
    if (saving) return;
    if (dirty && !window.confirm(locale === "fr" ? "Abandonner les modifications non enregistrées ?" : "Discard unsaved changes?")) return;
    onClose();
  }
  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setSaveError("");
    try { await onSave(f); } catch { setSaveError(locale === "fr" ? "Enregistrement impossible. Vos modifications sont conservées, vous pouvez réessayer." : "Unable to save. Your changes are kept; please retry."); }
    finally { setSaving(false); }
  }
  return (
    <Dialog open onOpenChange={open => { if (!open) requestClose(); }}>
      <DialogContent className="rounded-2xl max-h-[90dvh] overflow-y-auto" onPointerDownOutside={event => event.preventDefault()} onInteractOutside={event => event.preventDefault()} onEscapeKeyDown={event => event.preventDefault()}>
        <DialogTitle>{initial.id ? t("edit_type") : t("new_type")}</DialogTitle>
        <DialogDescription>{locale === "fr" ? "La fenêtre reste ouverte pendant la saisie. Enregistrez pour appliquer vos modifications." : "This window stays open while editing. Save to apply your changes."}</DialogDescription>
        <form onSubmit={submit}>
        <fieldset disabled={saving} className="space-y-3">
          <Field label={t("contexts")} help={help("contexts")}><div className="flex flex-wrap gap-3">{CONTEXTS.map(c => <label key={c} className="text-sm flex gap-2 items-center"><input type="checkbox" checked={contextsFor(f).includes(c)} onChange={e => { const next = e.target.checked ? [...contextsFor(f), c] : contextsFor(f).filter(v => v !== c); if (next.length) set("contexts", next); }} />{c === "general" ? t(c) : c.toUpperCase()}</label>)}</div></Field>
          <div className="grid grid-cols-2 gap-3">
          {["reminder_24h", "reminder_1h"].map(k => <Field key={k} label={t(k)} help={help(k)}><select className={inp} value={f[k] || "inherit"} onChange={e => set(k, e.target.value)}>{["inherit", "on", "off"].map(v => <option key={v} value={v}>{t(v === "off" ? "disabled" : v)}</option>)}</select></Field>)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("name_en_label")} help={help("name_en_label")}><input className={inp} value={f.name_en || ""} onChange={(e) => set("name_en", e.target.value)} /></Field>
            <Field label={t("name_fr_label")} help={help("name_fr_label")}><input className={inp} value={f.name_fr || ""} onChange={(e) => set("name_fr", e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("desc_en_label")} help={help("desc_en_label")}><input className={inp} value={f.description_en || ""} onChange={(e) => set("description_en", e.target.value)} /></Field>
            <Field label={t("desc_fr_label")} help={help("desc_fr_label")}><input className={inp} value={f.description_fr || ""} onChange={(e) => set("description_fr", e.target.value)} /></Field>
          </div>
          <Field label={t("slug")} help={help("slug")}><input className={inp} value={f.slug} onChange={(e) => set("slug", e.target.value)} placeholder={t("auto_from_title")} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("duration_min_label")} help={help("duration_min_label")}><input type="number" className={inp} value={f.duration} onChange={(e) => set("duration", +e.target.value)} /></Field>
            <Field label={t("brand_context")} help={help("brand_context")}><input className={inp} value={f.brand} onChange={(e) => set("brand", e.target.value)} /></Field>
            <Field label={t("buffer_before")} help={help("buffer_before")}><input type="number" className={inp} value={f.buffer_before} onChange={(e) => set("buffer_before", +e.target.value)} /></Field>
            <Field label={t("buffer_after")} help={help("buffer_after")}><input type="number" className={inp} value={f.buffer_after} onChange={(e) => set("buffer_after", +e.target.value)} /></Field>
            <Field label={t("min_notice")} help={help("min_notice")}><input type="number" className={inp} value={f.minimum_notice_minutes} onChange={(e) => set("minimum_notice_minutes", +e.target.value)} /></Field>
            <Field label={t("max_per_day")} help={help("max_per_day")}><input type="number" className={inp} value={f.max_per_day} onChange={(e) => set("max_per_day", +e.target.value)} /></Field>
            <Field label={t("booking_window")} help={help("booking_window")}><input type="number" className={inp} value={f.booking_window_days} onChange={(e) => set("booking_window_days", +e.target.value)} /></Field>
            <Field label={t("sort_order")} help={help("sort_order")}><input type="number" className={inp} value={f.sort_order} onChange={(e) => set("sort_order", +e.target.value)} /></Field>
          </div>
          <Field label={t("location_type")} help={help("location_type")}>
            <select className={inp} value={f.location_type} onChange={(e) => set("location_type", e.target.value)}>
              <option value="google_meet">{t("loc_google_meet")}</option>
              <option value="phone">{t("loc_phone")}</option>
              <option value="physical">{t("loc_physical")}</option>
              <option value="custom">{t("loc_custom")}</option>
            </select>
          </Field>
          {f.location_type !== "google_meet" && (
            <Field label={t("location_value")} help={help("location_value")}><input className={inp} value={f.location_value} onChange={(e) => set("location_value", e.target.value)} /></Field>
          )}
          <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} /> {t("active")}</label>
        </fieldset>
        {saveError && <p role="alert" className="text-sm text-destructive mt-3">{saveError}</p>}
        {dirty && <p role="status" className="text-xs text-muted-foreground mt-3">{locale === "fr" ? "Modifications non enregistrées" : "Unsaved changes"}</p>}
        <div className="flex gap-2 mt-6 sticky bottom-0 bg-card py-3">
          <button type="submit" disabled={saving || (!f.name_en && !f.name_fr && !f.name)} className="min-h-11 flex-1 bg-primary text-white font-semibold text-sm py-2.5 rounded-xl disabled:opacity-40">{saving ? t("loading") : t("save")}</button>
          <button type="button" disabled={saving} onClick={requestClose} className="min-h-11 px-4 border border-border/70 text-muted-foreground text-sm hover:text-foreground rounded-xl">{t("cancel_btn")}</button>
        </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const inp = "w-full bg-background border border-border/70 rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none";
function Field({ label, help, children }) {
  const id = useId();
  const { locale } = useI18n();
  const isControl = ["input", "select", "textarea"].includes(children.type);
  return <div className="min-w-0">
    <div className="flex items-center gap-1 mb-1">
      <label htmlFor={isControl ? id : undefined} className="text-label text-muted-foreground">{label}</label>
      {help && <Popover>
        <PopoverTrigger asChild>
          <button type="button" aria-label={(locale === "fr" ? "Aide : " : "Help: ") + label} title={help} className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="z-[60] max-w-[calc(100vw-2rem)] text-sm leading-relaxed">
          <p className="font-semibold mb-2">{label}</p><p>{help}</p>
        </PopoverContent>
      </Popover>}
    </div>
    {isControl ? cloneElement(children, {id, "aria-describedby": help ? id + "-help" : undefined}) : children}
    {help && <span id={id + "-help"} className="sr-only">{help}</span>}
  </div>;
}
function slugify(s) { return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
