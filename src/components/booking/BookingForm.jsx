import PhoneInput from "@/components/PhoneInput";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

export default function BookingForm({ ctaLabel, disabled = false, defaultContext, defaultCompany, defaultName = "", defaultEmail = "", defaultPhone = "", onSubmit, submitting, error }) {
  const { t } = useI18n();
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState(defaultPhone);
  const [email, setEmail] = useState(defaultEmail);
  const [company, setCompany] = useState(defaultCompany || "");
  const [context, setContext] = useState(defaultContext || "");

  const submit = (e) => {
    e.preventDefault();
    if (!name || !email) return;
    onSubmit({ name, email, phone, company, context });
  };

  const inputCls =
    "w-full bg-background border border-border/70 rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all";

  return (
    <form onSubmit={submit} className="mt-7 pt-6 border-t border-border/50 animate-fade-in space-y-3">
      <div className="text-xs font-heading font-medium text-muted-foreground/80 tracking-[0.14em] uppercase mb-1">{t("your_details")}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1.5">{t("name")}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus className={inputCls} placeholder={t("name_ph")} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1.5">{t("email")}</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} placeholder={t("email_ph")} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1.5">{t("company")} <span className="text-muted-foreground/60">{t("optional")}</span></label>
          <input value={company} onChange={(e) => setCompany(e.target.value)} className={inputCls} placeholder={t("company_ph")} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1.5">{t("topic")} <span className="text-muted-foreground/60">{t("optional")}</span></label>
          <input value={context} onChange={(e) => setContext(e.target.value)} className={inputCls} placeholder={t("topic_ph")} />
        </div>
      </div>
      <div>
        <label htmlFor="booking-phone" className="text-xs text-muted-foreground block mb-1.5">{t("crm_phone")} {t("optional")}</label>
        <PhoneInput id="booking-phone" value={phone} onChange={setPhone} className={inputCls} />
      </div>
      {error && <p className="text-sm text-coral">{error}</p>}
      <button
        type="submit"
        disabled={disabled || submitting || !name || !email}
        className="w-full bg-primary text-white font-semibold text-sm py-3.5 rounded-xl hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-soft"
      >
        {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> {t("confirming")}</> : (ctaLabel || t("confirm_booking"))}
      </button>
    </form>
  );
}
