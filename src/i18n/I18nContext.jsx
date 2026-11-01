import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { translations } from "./translations";

const SUPPORTED = ["en", "fr"];
const STORAGE_KEY = "opentalk_locale";
const INTL_LOCALE = { en: "en-US", fr: "fr-FR" };

function detectInitial() {
  // 1. ?lang= query param takes precedence (e.g. /e/project-a?lang=fr)
  try {
    const params = new URLSearchParams(window.location.search);
    const lang = params.get("lang");
    if (lang && SUPPORTED.includes(lang)) return lang;
  } catch {}
  // 2. localStorage preference
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED.includes(saved)) return saved;
  } catch {}
  // 3. Browser language — French defaults to French, otherwise English
  try {
    const nav = (navigator.languages?.[0] || navigator.language || "en").toLowerCase();
    if (nav.startsWith("fr")) return "fr";
  } catch {}
  return "en";
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(detectInitial);

  const setLocale = useCallback((l) => {
    if (!SUPPORTED.includes(l)) return;
    setLocaleState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
  }, []);

  // Persist the initial choice so a detected browser language sticks.
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, locale); } catch {}
  }, [locale]);

  const t = useCallback((key, vars) => {
    const entry = translations[key];
    let str = entry ? (entry[locale] !== undefined ? entry[locale] : entry.en) : key;
    if (vars && typeof str === "string") {
      for (const k in vars) str = str.replace(new RegExp(`\\{${k}\\}`, "g"), vars[k]);
    }
    return str;
  }, [locale]);

  const intlLocale = INTL_LOCALE[locale] || "en-US";

  const formatTime = useCallback((iso, tz) => {
    try {
      return new Intl.DateTimeFormat(intlLocale, { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
    } catch {
      return new Date(iso).toUTCString().slice(16, 22);
    }
  }, [intlLocale]);

  const formatDate = useCallback((iso, tz) => {
    try {
      return new Intl.DateTimeFormat(intlLocale, { timeZone: tz, weekday: "long", month: "long", day: "numeric" }).format(new Date(iso));
    } catch {
      return iso;
    }
  }, [intlLocale]);

  const value = useMemo(
    () => ({ locale, setLocale, t, formatTime, formatDate, intlLocale }),
    [locale, setLocale, t, formatTime, formatDate, intlLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

// Helper to pick a localized field from an entity (e.g. name_fr / name_en) with fallback.
export function localizedField(obj, base, locale) {
  if (!obj) return "";
  return obj[`${base}_${locale}`] || obj[base] || "";
}
