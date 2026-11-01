// Timezone helpers — all conversions go through Intl to handle DST correctly.
// Locale-aware formatting: locale is "en" | "fr".

const INTL_LOCALE = { en: "en-US", fr: "fr-FR" };
function intl(locale) {
  return INTL_LOCALE[locale] || INTL_LOCALE.en;
}

// Resolve wall time against the timezone's actual offsets, including both sides
// of a transition. Ambiguous times use the earlier instant; gaps are rejected.
export function zonedToUTC(dateStr, timeStr, tz) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(timeStr)) throw new RangeError("Invalid wall time");
  const wall = Date.parse(`${dateStr}T${timeStr}:00Z`);
  if (!Number.isFinite(wall) || new Date(wall).toISOString().slice(0, 10) !== dateStr) throw new RangeError("Invalid date");
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
  const localEpoch = epoch => {
    const p = Object.fromEntries(formatter.formatToParts(new Date(epoch)).map(p => [p.type, p.value]));
    return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  };
  const candidates = new Set();
  for (const hours of [-36, -12, 0, 12, 36]) {
    const sample = wall + hours * 3600000;
    const candidate = wall - (localEpoch(sample) - sample);
    if (localEpoch(candidate) === wall) candidates.add(candidate);
  }
  if (!candidates.size) throw new RangeError("Nonexistent local time");
  return new Date(Math.min(...candidates));
}

export function localDayBounds(dateStr, tz) {
  const next = new Date(`${dateStr}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return { start: zonedToUTC(dateStr, "00:00", tz).toISOString(), end: zonedToUTC(next.toISOString().slice(0, 10), "00:00", tz).toISOString() };
}

// Get the date (YYYY-MM-DD) of a UTC instant in a given timezone.
export function zonedDate(iso, tz) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date(iso));
  const obj = {};
  for (const p of parts) obj[p.type] = p.value;
  return `${obj.year}-${obj.month}-${obj.day}`;
}

// Format a UTC instant in a timezone as a locale-aware time label.
// en -> "9:00 AM", fr -> "09:00".
export function zonedTime(iso, tz, locale = "en") {
  try {
    return new Intl.DateTimeFormat(intl(locale), {
      timeZone: tz, hour: "numeric", minute: "2-digit"
    }).format(new Date(iso));
  } catch {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz, hour12: false, hour: "2-digit", minute: "2-digit"
    }).formatToParts(new Date(iso));
    const obj = {};
    for (const p of parts) obj[p.type] = p.value;
    return `${obj.hour}:${obj.minute}`;
  }
}

// Locale-aware long date, e.g. "Monday, September 7" / "lundi 7 septembre".
export function formatDateDisplay(iso, tz, locale = "en") {
  try {
    return new Intl.DateTimeFormat(intl(locale), {
      timeZone: tz, weekday: "long", month: "long", day: "numeric"
    }).format(new Date(iso));
  } catch {
    return zonedDate(iso, tz);
  }
}

// Short uppercase weekday for a YYYY-MM-DD date, e.g. "MON" / "LUN".
export function weekdayShort(dateStr, locale = "en") {
  try {
    const s = new Intl.DateTimeFormat(intl(locale), {
      timeZone: "UTC", weekday: "short"
    }).format(new Date(dateStr + "T12:00:00Z"));
    return s.replace(/\.$/, "").toUpperCase();
  } catch {
    return "";
  }
}

// Day of week (0=Sun ... 6=Sat) for a date string in a timezone.
export function zonedWeekday(dateStr, tz) {
  const noon = zonedToUTC(dateStr, "12:00", tz);
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(noon);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
}

// Human timezone label, e.g. "Bangkok · GMT+7" (locale-neutral).
export function timezoneLabel(tz) {
  try {
    const offset = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, timeZoneName: "shortOffset"
    }).formatToParts(new Date()).find(p => p.type === "timeZoneName")?.value || "";
    const city = tz.split("/").pop().replace(/_/g, " ");
    return `${city} · ${offset}`;
  } catch {
    return tz;
  }
}
