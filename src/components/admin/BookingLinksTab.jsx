import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { useI18n, localizedField } from "@/i18n/I18nContext";
import { Loader2, Plus, Pencil, Trash2, X, Copy } from "lucide-react";

const EMPTY = { slug: "", title: "", context: "", company: "", contact_name: "", booking_type_id: "", locale: "", valid_from: "", valid_until: "", active: true };

export default function BookingLinksTab({ types }) {
  const { t, locale } = useI18n();
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = () => {
    setLoading(true);
    api.entities.BookingLink.filter({}).then((l) => setLinks(l)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const save = async (data) => {
    const payload = { ...data, slug: data.slug || slugify(data.title || data.context || "") };
    if (!payload.slug) return;
    if (editing.id) await api.entities.BookingLink.update(editing.id, payload);
    else await api.entities.BookingLink.create(payload);
    setEditing(null);
    load();
  };
  const remove = async (id) => {
    if (!confirm(t("delete_link_confirm"))) return;
    await api.entities.BookingLink.delete(id);
    load();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-label text-muted-foreground">{t("contextual_links")}</div>
        <button onClick={() => setEditing({ ...EMPTY })} className="flex items-center gap-1.5 text-sm text-foreground border border-border/70 rounded-lg px-3 py-1.5 hover:bg-secondary/60 transition-colors">
          <Plus className="w-4 h-4" /> {t("new_link")}
        </button>
      </div>

      <div className="border border-border/60 rounded-2xl divide-y divide-border/60 overflow-hidden">
        {links.map((l) => {
          const url = `${window.location.origin}/e/${l.slug}${l.locale ? `?lang=${l.locale}` : ""}`;
          return (
            <div key={l.id} className="px-4 py-3 flex items-center justify-between gap-4 bg-card/40">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-foreground font-medium">{l.title || l.slug}</span>
                  {l.locale && <span className="text-label text-primary border border-primary/30 px-1.5 py-0.5 rounded-full uppercase">{l.locale}</span>}
                  {!l.active && <span className="text-label text-coral">{t("inactive")}</span>}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <code className="text-xs text-emerald">/e/{l.slug}{l.locale ? `?lang=${l.locale}` : ""}</code>
                  <button onClick={() => navigator.clipboard?.writeText(url)} className="text-muted-foreground hover:text-foreground"><Copy className="w-3 h-3" /></button>
                  {l.context && <span className="text-xs text-muted-foreground truncate">· {l.context}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => setEditing(l)} className="text-muted-foreground hover:text-foreground p-1.5"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => remove(l.id)} className="text-muted-foreground hover:text-coral p-1.5"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          );
        })}
        {links.length === 0 && <div className="px-4 py-8 text-center text-sm text-muted-foreground">{t("no_links")}</div>}
      </div>

      {editing && <LinkForm initial={editing} types={types} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}

function LinkForm({ initial, types, onSave, onClose }) {
  const { t, locale } = useI18n();
  const [f, setF] = useState(initial);
  const [pages,setPages]=useState([]);
  useEffect(()=>{api.functions.invoke("adminPages",{action:"list"}).then(r=>setPages(r.data.pages.filter(p=>p.status==="published").map(p=>({...JSON.parse(p.published_json),id:p.id})).filter(p=>p.active)));},[]);
  const page=pages.find(p=>p.id===f.booking_page_id);
  const assigned=page?types.filter(tp=>page.booking_type_ids.includes(tp.id) && !page.type_overrides?.some(o=>o.booking_type_id===tp.id && o.visible===false)):types;
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div className="fixed inset-0 bg-background/80 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-card border border-border/70 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-soft-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-heading text-lg font-semibold">{initial.id ? t("edit_link") : t("new_link")}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground hover:text-foreground" /></button>
        </div>
        <div className="space-y-3">
          <Field label={t("pages_title")}><select className={inp} value={f.booking_page_id || ""} onChange={e=>{const p=pages.find(p=>p.id===e.target.value);setF(prev=>({...prev,booking_page_id:e.target.value,booking_context:p?.context_key || "",booking_type_id:""}));}}><option value="">{t("pages_none")}</option>{pages.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <Field label={t("title")}><input className={inp} value={f.title} onChange={(e) => set("title", e.target.value)} /></Field>
          <Field label={t("link_slug")}><input className={inp} value={f.slug} onChange={(e) => set("slug", e.target.value)} placeholder={t("auto_from_title")} /></Field>
          <Field label={t("link_context")}><input className={inp} value={f.context} onChange={(e) => set("context", e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("company")}><input className={inp} value={f.company} onChange={(e) => set("company", e.target.value)} /></Field>
            <Field label={t("contact_name")}><input className={inp} value={f.contact_name} onChange={(e) => set("contact_name", e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("booking_type_preselect")}>
              <select className={inp} value={f.booking_type_id} onChange={(e) => set("booking_type_id", e.target.value)}>
                <option value="">{t("let_visitor_choose")}</option>
                {assigned.map((tp) => <option key={tp.id} value={tp.id}>{localizedField(tp, "name", locale) || tp.name}</option>)}
              </select>
            </Field>
            <Field label={t("default_locale")}>
              <select className={inp} value={f.locale || ""} onChange={(e) => set("locale", e.target.value)}>
                <option value="">{t("let_visitor_choose")}</option>
                <option value="en">EN</option>
                <option value="fr">FR</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("valid_from")}><input type="datetime-local" className={inp} value={f.valid_from ? toLocal(f.valid_from) : ""} onChange={(e) => set("valid_from", e.target.value ? fromLocal(e.target.value) : "")} /></Field>
            <Field label={t("valid_until")}><input type="datetime-local" className={inp} value={f.valid_until ? toLocal(f.valid_until) : ""} onChange={(e) => set("valid_until", e.target.value ? fromLocal(e.target.value) : "")} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-foreground"><input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} /> {t("active")}</label>
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={() => onSave(f)} disabled={!f.title && !f.context} className="flex-1 bg-primary text-white font-semibold text-sm py-2.5 rounded-xl disabled:opacity-40">{t("save")}</button>
          <button onClick={onClose} className="px-4 border border-border/70 text-muted-foreground text-sm hover:text-foreground rounded-xl">{t("cancel_btn")}</button>
        </div>
      </div>
    </div>
  );
}

const inp = "w-full bg-background border border-border/70 rounded-lg px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none";
function Field({ label, children }) {
  return <div><label className="text-label text-muted-foreground block mb-1">{label}</label>{children}</div>;
}
function slugify(s) { return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function toLocal(iso) { return new Date(iso).toISOString().slice(0, 16); }
function fromLocal(v) { return new Date(v).toISOString(); }
