import { useI18n } from "@/i18n/I18nContext";

export default function LanguageSwitcher({ className = "" }) {
  const { locale, setLocale } = useI18n();
  return (
    <div className={`inline-flex items-center gap-1.5 text-xs ${className}`}>
      {["en", "fr"].map((l, i) => (
        <span key={l} className="inline-flex items-center gap-1.5">
          {i > 0 && <span className="text-muted-foreground/40">/</span>}
          <button
            onClick={() => setLocale(l)}
            className={`uppercase tracking-[0.14em] font-heading font-medium transition-colors ${
              locale === l ? "text-foreground" : "text-muted-foreground/60 hover:text-foreground"
            }`}
          >
            {l}
          </button>
        </span>
      ))}
    </div>
  );
}
