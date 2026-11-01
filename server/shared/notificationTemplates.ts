import { PRODUCT_CONFIG } from "./productConfig.ts";

const copy = {
  en: { confirmation: "You’re booked.", rescheduled: "Your meeting has been rescheduled.", cancelled: "Your meeting has been cancelled.", reminder_24h: "Your meeting is tomorrow.", reminder_1h: "Your meeting starts in one hour.", hello: "Hello", with: `with ${PRODUCT_CONFIG.hostName}`, date: "Date", time: "Time", duration: "Duration", location: "Location", topic: "Topic", manage: "View my appointment", cancel: "Cancel booking" },
  fr: { confirmation: "Rendez-vous confirmé.", rescheduled: "Votre rendez-vous a été replanifié.", cancelled: "Votre rendez-vous a été annulé.", reminder_24h: "Votre rendez-vous a lieu demain.", reminder_1h: "Votre rendez-vous commence dans une heure.", hello: "Bonjour", with: `avec ${PRODUCT_CONFIG.hostName}`, date: "Date", time: "Heure", duration: "Durée", location: "Lieu", topic: "Sujet", manage: "Voir mon rendez-vous", cancel: "Annuler le rendez-vous" }
};
export const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export function notificationTemplate(booking, kind, appBase) {
  const locale = booking.locale === "fr" ? "fr" : "en";
  const c = copy[locale], fmt = locale === "fr" ? "fr-FR" : "en-GB", tz = booking.timezone || "UTC";
  const title = booking.booking_type_name || (locale === "fr" ? "Rendez-vous" : "Meeting");
  const context = String(booking.context || "general").toUpperCase();
  const date = new Intl.DateTimeFormat(fmt, { timeZone: tz, dateStyle: "full" }).format(new Date(booking.start_at));
  const time = new Intl.DateTimeFormat(fmt, { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(booking.start_at));
  const duration = booking.duration || Math.round((Date.parse(booking.end_at) - Date.parse(booking.start_at)) / 60000);
  const manage = appBase.replace(/\/$/, "") + "/m/" + encodeURIComponent(booking.reschedule_token) + "?lang=" + locale;
  const cancel = appBase.replace(/\/$/, "") + "/m/" + encodeURIComponent(booking.cancel_token) + "?lang=" + locale;
  const rows = [[c.date, date], [c.time, time + " · " + tz], [c.duration, duration + " min"], [c.location, booking.meeting_url || booking.location_value], [c.topic, booking.topic]].filter(r => r[1]);
  const subject = c[kind] + " · " + context + " · " + title;
  const text = [c.hello + " " + booking.name + ",", c[kind], title + " " + c.with, PRODUCT_CONFIG.mark + " / " + context, ...rows.map(r => r.join(": ")), ...(kind === "cancelled" ? [] : [c.manage + ": " + manage, c.cancel + ": " + cancel])].join("\n\n");
  const html = '<!doctype html><html lang="' + locale + '"><body style="margin:0;background:#f6f2ea;color:#2d2822;font-family:Arial,sans-serif;padding:24px"><div style="max-width:560px;margin:auto;background:#fffdfa;padding:28px;border-radius:16px"><p style="font-size:12px;letter-spacing:2px">' + escapeHtml(PRODUCT_CONFIG.mark) + ' / ' + escapeHtml(context) + '</p><h1 style="font-family:Georgia,serif;font-size:30px">' + escapeHtml(c[kind]) + '</h1><p>' + escapeHtml(c.hello + " " + booking.name) + ',</p><h2 style="font-size:19px">' + escapeHtml(title + " " + c.with) + '</h2>' + rows.map(r => '<p><strong>' + escapeHtml(r[0]) + '</strong><br>' + escapeHtml(r[1]) + '</p>').join("") + (kind === "cancelled" ? "" : '<p><a style="display:inline-block;background:#a75f43;color:#ffffff;padding:12px 18px;border-radius:10px;text-decoration:none" href="' + escapeHtml(manage) + '">' + escapeHtml(c.manage) + '</a> · <a style="color:#a75f43" href="' + escapeHtml(cancel) + '">' + escapeHtml(c.cancel) + '</a></p>') + '</div></body></html>';
  return { subject, text, html };
}
