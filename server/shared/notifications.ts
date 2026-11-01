import {env} from "../env.ts";
import { EMAIL_CONFIG } from "./emailConfig.ts";
import { notificationTemplate } from "./notificationTemplates.ts";
export function reminderDue(booking, hours, now = Date.now()) {
  if (!["confirmed", "rescheduled"].includes(booking.status)) return false;
  const start = Date.parse(booking.start_at), due = start - hours * 3600000;
  const scheduled = Date.parse(booking.notification_revision?.split("|")[0] || booking.created_date || booking.created_at || "1970-01-01");
  // Never send a stale 24h reminder alongside the 1h reminder or after a late booking.
  return Number.isFinite(start) && now >= due && now < start && now - due < 30 * 60000 && scheduled <= due;
}
export function reminderEnabled(type, settings, key) {
  return type?.[key] === "on" || (type?.[key] !== "off" && settings.find(s => s.key === key)?.value !== "false");
}
export async function notifyBooking(platform, booking, kind, settings, notifyEmail = undefined) {
  const db = platform.asServiceRole.entities;
  const revision = booking.notification_revision || booking.start_at;
  const key = [booking.id, revision, kind].join("/");
  let logs = await db.EmailLog.filter({ dedupe_key: key }, "created_date", 100);
  if (logs.some(l => l.status === "sent" || l.status === "review_required" || l.status === "skipped")) return;
  let log = logs[0];
  if (!log) log = await db.EmailLog.create({ booking_id: booking.id, recipient: booking.email, email_type: kind, locale: booking.locale || "en", provider: "resend", status: "pending", dedupe_key: key, start_at: booking.start_at, revision });
  const fresh = await db.Booking.get(booking.id);
  if((notifyEmail ?? fresh.notify_email) === false) {
    await db.EmailLog.update(log.id,{status:"skipped",error:"",error_message:""});return;
  }
  if ((fresh.notification_revision || fresh.start_at) !== revision || (kind === "cancelled" ? fresh.status !== "cancelled" : fresh.status === "cancelled") || (kind.startsWith("reminder") && !reminderDue(fresh, kind === "reminder_24h" ? 24 : 1))) {
    await db.EmailLog.update(log.id, { status: "skipped", error: "Booking changed or reminder window expired" }); return;
  }
  if (kind.startsWith("reminder")) {
    const type = await db.BookingType.get(fresh.booking_type_id);
    if (!reminderEnabled(type, settings, kind)) {
      await db.EmailLog.update(log.id, { status: "skipped", error: "Reminder disabled" }); return;
    }
  }
  const apiKey = env("RESEND_API_KEY"), from = (env("RESEND_FROM")?.trim() || EMAIL_CONFIG.from);
  const appBase = settings.find(s => s.key === "app_base_url")?.value;
  if (!apiKey || !from || !appBase || !/^https:\/\//.test(appBase)) {
    await db.EmailLog.update(log.id, { status: "pending_configuration", error: "Configure RESEND_API_KEY, RESEND_FROM and HTTPS app_base_url" }); return;
  }
  // Persist a stable payload before sending. Resend idempotency expires at 24h.
  // Ambiguous attempts older than 23h require review; they are never blindly retried.
  if (log.first_attempt_at && Date.now() - Date.parse(log.first_attempt_at) >= 23 * 3600000) {
    await db.EmailLog.update(log.id, { status: "review_required", error: "Resend idempotency window expiring; verify provider status before retrying" }); return;
  }
  const payload = log.payload_json || JSON.stringify({ from, to: [booking.email], ...notificationTemplate(booking, kind, appBase) });
  await db.EmailLog.update(log.id, { status: "sending", first_attempt_at: log.first_attempt_at || new Date().toISOString(), payload_json: payload, error: "" });
  try {
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json", "Idempotency-Key": key }, body: payload, signal: AbortSignal.timeout(15000) });
    const result = await response.json();
    if (!response.ok || !result.id) throw new Error("Resend HTTP " + response.status + ": " + (result.name || "send_failed"));
    await db.EmailLog.update(log.id, { status: "sent", provider_message_id: result.id, sent_at: new Date().toISOString(), error: "" });
  } catch (error) {
    await db.EmailLog.update(log.id, { status: "failed", error: String(error.message).slice(0, 400) });
  }
}
export async function safeNotify(platform, booking, kind, settings, notifyEmail = undefined) {
  try { await notifyBooking(platform, booking, kind, settings, notifyEmail); }
  catch { console.error("Notification persistence failed", booking.id, kind); }
}
