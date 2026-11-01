export function validTimezone(value) {
  if (!value) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
}
export function validPublicUrl(value) {
  try {
    const url = new URL(value);
    const local = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return (url.protocol === "https:" || local) && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash;
  } catch { return false; }
}
export function setupStatus({ settings = [], types = [], rules = [], pages = [] }) {
  const values = Object.fromEntries(settings.map(s => [s.key, s.value]));
  const activeTypes = types.filter(t => t.active && Number(t.duration) > 0);
  const usableRules = rules.filter(r => r.active && Number.isInteger(r.day_of_week) && r.day_of_week >= 0 && r.day_of_week <= 6 && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(r.start_time || "") && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(r.end_time || "") && r.start_time < r.end_time && (!r.booking_type_id || activeTypes.some(t => t.id === r.booking_type_id)));
  const rootRows = pages.filter(p => p.status === "published" && p.published_slug === "/");
  let root = null;
  try { if (rootRows.length === 1) { const p = JSON.parse(rootRows[0].published_json); if (p.active) root = { ...p, id: rootRows[0].id }; } } catch { /* A malformed snapshot is not ready. */ }
  const rootTypes = activeTypes.filter(t => root?.booking_type_ids?.includes(t.id) && !root.type_overrides?.some(o => o.booking_type_id === t.id && o.visible === false));
  const languages = root?.language_mode === "auto" ? ["en", "fr"] : [root?.language_mode || "en"];
  const steps = [
    !!values.brand_name?.trim() && validTimezone(values.reference_timezone) && validPublicUrl(values.app_base_url),
    activeTypes.length > 0,
    usableRules.length > 0,
    !!root && rootTypes.length > 0 && languages.every(l => root["headline_" + l] && root["primary_cta_" + l]) && rootTypes.some(t => usableRules.some(r => !r.booking_type_id || r.booking_type_id === t.id)),
  ];
  return { values, activeTypes, root, rootTypes, steps, ready: steps.every(Boolean), completed: steps.filter(Boolean).length, next: Math.max(0, steps.findIndex(ok => !ok)) };
}
