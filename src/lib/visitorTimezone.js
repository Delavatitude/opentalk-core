const KEY = "opentalk_booking_timezone";
export function validZone(zone) {
  if (typeof zone !== "string" || !zone) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: zone }); return true; } catch { return false; }
}
export function initialTimezone() {
  try { const saved = localStorage.getItem(KEY); if (validZone(saved)) return saved; } catch { /* Storage may be unavailable. */ }
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
}
export function rememberTimezone(zone) {
  try { localStorage.setItem(KEY, zone); } catch { /* Selection still works without storage. */ }
}
export function timezoneChoices(current) {
  let zones = [];
  try { zones = Intl.supportedValuesOf("timeZone"); } catch { zones = ["Europe/Paris", "Europe/London", "America/New_York", "America/Los_Angeles", "America/Toronto", "Asia/Tokyo", "Asia/Dubai", "Asia/Ho_Chi_Minh", "Australia/Sydney", "Pacific/Auckland"]; }
  return [...new Set(["UTC", current, ...zones])].filter(validZone).sort();
}
export function utcOffset(zone, instant = new Date()) {
  const offset = new Intl.DateTimeFormat("en-GB", {timeZone:zone,timeZoneName:"shortOffset"}).formatToParts(new Date(instant)).find(part => part.type === "timeZoneName")?.value || "GMT";
  return offset === "GMT" ? "UTC+0" : offset.replace("GMT","UTC");
}
function localDate(value, zone) {
  const parts = new Intl.DateTimeFormat("en-CA", {timeZone: zone, year:"numeric", month:"2-digit", day:"2-digit"}).formatToParts(new Date(value));
  const get = type => parts.find(p => p.type === type).value;
  return get("year") + "-" + get("month") + "-" + get("day");
}
// The backend groups by the host's days. Re-group UTC instants by the guest's
// calendar day so crossing midnight never shows a time under the wrong date.
export function visitorDays(days, zone, locale) {
  const language = locale === "fr" ? "fr-FR" : "en-GB";
  const grouped = new Map();
  for (const day of days || []) {
    const date = localDate(day.date + "T12:00:00Z", zone);
    if (!grouped.has(date)) grouped.set(date, []);
    for (const slot of day.slots || []) {
      const date = localDate(slot.start_at, zone);
      if (!grouped.has(date)) grouped.set(date, []);
      const label = new Intl.DateTimeFormat(language, {timeZone:zone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(slot.start_at));
      grouped.get(date).push({...slot,label,offset:utcOffset(zone, slot.start_at)});
    }
  }
  return [...grouped].sort(([a],[b]) => a.localeCompare(b)).map(([date,slots]) => ({
    date,
    dayLabel: new Intl.DateTimeFormat(language,{timeZone:"UTC",weekday:"short"}).format(new Date(date + "T12:00:00Z")),
    dayNumber:Number(date.slice(8,10)),
    slots:slots.sort((a,b) => Date.parse(a.start_at)-Date.parse(b.start_at)),
  }));
}
