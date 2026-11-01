import { useState, useEffect, useCallback } from "react";
import SetupGuide, { loadSetup } from "@/components/admin/SetupGuide";
import { setupStatus } from "@/lib/setupStatus";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import MyPageTab from "@/components/admin/MyPageTab";
import DashboardTab from "@/components/admin/DashboardTab";
import ContactsTab from "@/components/admin/ContactsTab";
import BookingOverview from "@/components/admin/BookingOverview";
import BookingTypesTab from "@/components/admin/BookingTypesTab";

import AvailabilityTab from "@/components/admin/AvailabilityTab";
import BookingLinksTab from "@/components/admin/BookingLinksTab";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useI18n } from "@/i18n/I18nContext";
import { LogOut } from "lucide-react";
import { PRODUCT } from "@/config/product";

const TABS = [
 {id:"dashboard",key:"pages_dashboard"},{id:"bookings",key:"pages_bookings"},
 {id:"contacts",key:"crm_contacts"},{id:"my-page",key:"my_page"},
 {id:"types",key:"tab_types"},{id:"availability",key:"tab_availability"},

];

export default function Admin() {
  const { t, locale } = useI18n();
  const [setupData, setSetupData] = useState(null), [setupError, setSetupError] = useState(false);
  const [completedInSession, setCompletedInSession] = useState(false);
  const refreshSetup = useCallback(async () => {
    const data = await loadSetup(); setSetupData(data); setSetupError(false); return data;
  }, []);
  const [selectedTab, setTab] = useState("dashboard");
  const location = useLocation(), navigate = useNavigate();
  const section = location.pathname.split("/")[2] || selectedTab;
  const status = setupData ? setupStatus(setupData) : null;
  const setupFinished = completedInSession || !!status?.values.onboarding_completed_at;
  function completeSetup() { setCompletedInSession(true); navigate("/admin/dashboard", {replace:true}); }
  const tab = ["setup", "links"].includes(section) ? section : TABS.some(item => item.id === section) ? section : "dashboard";
  useEffect(() => { let active = true; loadSetup().then(data => { if (active) { setSetupData(data); setSetupError(false); } }).catch(() => { if (active) setSetupError(true); }); return () => {active = false;}; }, [section]);
  useEffect(() => {
    if (location.pathname === "/admin" && status && !setupFinished) navigate("/admin/setup", {replace:true});
    if (section === "setup" && setupFinished) navigate("/admin/dashboard", {replace:true});
  }, [location.pathname, section, !!status, setupFinished, navigate]);
  useEffect(() => {
    if (["pages", "settings", "notifications", "calendars"].includes(section)) navigate("/admin/my-page" + (["notifications","calendars"].includes(section) ? "#integrations" : ""), { replace: true });
  }, [section, navigate]);
  const [types, setTypes] = useState([]);

  const logout = () => api.auth.logout("/");

  useEffect(() => { api.entities.BookingType.filter({}).then(setTypes).catch(() => {}); }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="border-b border-border">
        <div className="max-w-[1200px] mx-auto px-5 sm:px-8 min-h-14 py-3 grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-center sm:flex sm:flex-wrap sm:justify-between">
          <div className="contents sm:flex sm:flex-wrap sm:min-w-0 sm:items-center sm:gap-3">
            <Link to="/" className="font-mono text-label text-foreground tracking-wider">{PRODUCT.mark}</Link>
            <nav className="col-span-2 row-start-2 flex min-w-0 items-center gap-1 max-w-full overflow-x-auto">
              {status && !setupFinished && <button onClick={() => navigate("/admin/setup")} aria-current={tab === "setup" ? "page" : undefined} className={"min-h-11 px-3 py-1.5 text-sm whitespace-nowrap " + (tab === "setup" ? "text-primary font-semibold" : "text-muted-foreground")}>{locale === "fr" ? "Configuration guidée" : "Guided setup"}</button>}
              {TABS.map((tb) => (
                <button key={tb.id} onClick={() => { setTab(tb.id); navigate("/admin/"+tb.id); }}
                  className={`px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${tab === tb.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {t(tb.key)}
                </button>
              ))}
            </nav>
          </div>
          <div className="col-start-2 row-start-1 justify-self-end flex shrink-0 items-center gap-3">
            <LanguageSwitcher />
            <button onClick={logout} aria-label={locale === "fr" ? "Se déconnecter" : "Log out"} className="text-muted-foreground hover:text-foreground min-h-11 min-w-11 inline-flex items-center justify-center sm:min-h-0 sm:min-w-0 sm:p-1.5"><LogOut className="w-4 h-4" aria-hidden="true" /></button>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-[1200px] mx-auto px-5 sm:px-8 py-8">
        {tab !== "setup" && status && !setupFinished && <div className="mb-6 rounded-2xl border border-primary/30 bg-primary/5 p-4 flex flex-wrap justify-between items-center gap-3"><div><p className="font-medium text-sm">{locale === "fr" ? "Votre configuration est à terminer" : "Finish your setup"}</p><p className="text-xs text-muted-foreground mt-1">{status.completed}/4 {locale === "fr" ? "étapes nécessaires terminées" : "required steps complete"}</p></div><Link to="/admin/setup" className="min-h-11 inline-flex items-center rounded-xl bg-primary text-primary-foreground px-4 text-sm">{locale === "fr" ? "Continuer la configuration" : "Continue setup"}</Link></div>}
        {setupError && <p role="alert" className="mb-4 text-sm text-destructive">{locale === "fr" ? "Impossible de vérifier la configuration." : "Unable to check setup."} <button className="underline min-h-11 px-2" onClick={() => refreshSetup().catch(() => setSetupError(true))}>{locale === "fr" ? "Réessayer" : "Retry"}</button></p>}
        {tab === "setup" && !setupData && !setupError && <p role="status">{t("loading")}</p>}
        {tab === "setup" && setupData && !setupFinished && <SetupGuide data={setupData} refresh={refreshSetup} onCompleted={completeSetup}/>}

        {tab === "contacts" && <ContactsTab />}
        {tab === "dashboard" && <DashboardTab />}
        {tab === "bookings" && <BookingOverview />}
        {tab === "my-page" && <MyPageTab />}
        {tab === "types" && <BookingTypesTab />}
        {tab === "links" && <BookingLinksTab types={types} />}
        {tab === "availability" && <AvailabilityTab />}
      </main>
    </div>
  );
}
