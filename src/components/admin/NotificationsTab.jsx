import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { useI18n } from "@/i18n/I18nContext";
import { PRODUCT } from "@/config/product";
export default function NotificationsTab() {
  const { t } = useI18n();
  const [settings, setSettings] = useState(null), [message, setMessage] = useState("");
  useEffect(() => { api.entities.Setting.filter({}).then(setSettings).catch(() => setMessage("load_error")); }, []);
  const [testing, setTesting] = useState(false), [testResult, setTestResult] = useState(null);
  async function testEmail() {
    setTesting(true); setTestResult(null);
    try { const r = await api.functions.invoke("sendTestEmail", {}); setTestResult(r.data); }
    catch (e) { setTestResult({success:false,error:e.response?.data?.error || "email_test_failed"}); }
    finally { setTesting(false); }
  }
  async function change(key, value) {
    setMessage("");
    try {
      const old = settings.find(s => s.key === key);
      const item = old ? await api.entities.Setting.update(old.id, { value }) : await api.entities.Setting.create({ key, value });
      setSettings(prev => [...prev.filter(s => s.key !== key), item]); setMessage("saved");
    } catch { setMessage("load_error"); }
  }
  return <div className="space-y-5 max-w-xl"><h2 className="font-heading text-xl">{t("notifications")}</h2><section className="border rounded-2xl p-4 space-y-3">
    <h3 className="font-heading font-semibold">{t("resend_test_title")}</h3>
    <p className="text-sm text-muted-foreground">{t("resend_test_intro")}</p>
    <p className="text-xs">{PRODUCT.name} · {t("notification_help")}</p>
    <button onClick={testEmail} disabled={testing} className="rounded-xl bg-primary text-white px-4 py-2 disabled:opacity-40">{t(testing ? "sending" : "resend_test_button")}</button>
    {testResult && <div role="status" className="text-sm break-words"><p>{t(testResult.success ? "resend_test_success" : testResult.error || "email_test_failed")}</p>{testResult.provider_message_id && <p>{t("resend_message_id")} : {testResult.provider_message_id}</p>}</div>}
    </section><p className="text-sm text-muted-foreground">{t("notification_help")}</p>{settings && ["reminder_24h", "reminder_1h"].map(key => <label key={key} className="flex items-center gap-3"><input type="checkbox" checked={settings.find(s => s.key === key)?.value !== "false"} onChange={e => change(key, String(e.target.checked))} />{t(key)}</label>)}{message && <p role="status">{t(message)}</p>}</div>;
}
