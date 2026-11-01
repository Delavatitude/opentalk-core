import { PRODUCT_CONFIG } from "./productConfig.ts";

// Bilingual, warm-toned email templates. Locale is "en" | "fr".
// Centralized so confirmation / cancellation / rescheduling emails match the booking language.

const PALETTE = {
  bg: "#F6F2EA",
  card: "#FEFDFB",
  border: "#E8E2D6",
  text: "#2A2622",
  muted: "#7A7268",
  faint: "#9A8E7E",
  accent: "#B97655",
  accentSoft: "#F3E7DE"
};

const COPY = {
  en: {
    brand: PRODUCT_CONFIG.mark,
    confirmedHeadline: "You're booked.",
    confirmedIntro: (name) => `Hi ${name},`,
    confirmedBody: (typeName, duration) => `Your <strong style="color:${PALETTE.text}">${typeName}</strong> (${duration} min) is confirmed.`,
    when: "When",
    context: "Context",
    join: "Join meeting",
    reschedule: "Reschedule",
    cancel: "Cancel booking",
    cancelledHeadline: "Booking cancelled.",
    cancelledBody: (name, typeName) => `Hi ${name}, your ${typeName} has been cancelled. The slot is now released — you can book a new time whenever you're ready.`,
    rescheduledHeadline: "Rescheduled.",
    rescheduledBody: (name, typeName, date, time, tz) => `Hi ${name}, your ${typeName} is now on <strong style="color:${PALETTE.text}">${date}</strong> at <strong style="color:${PALETTE.text}">${time}</strong> (${tz}).`,
    manage: "Manage booking",
    subjectConfirmed: (typeName) => `Confirmed: ${typeName} with ${PRODUCT_CONFIG.name}`,
    subjectCancelled: `Booking cancelled — ${PRODUCT_CONFIG.mark}`,
    subjectRescheduled: (typeName) => `Rescheduled: ${typeName} with ${PRODUCT_CONFIG.name}`
  },
  fr: {
    brand: PRODUCT_CONFIG.mark,
    confirmedHeadline: "Rendez-vous confirmé.",
    confirmedIntro: (name) => `Bonjour ${name},`,
    confirmedBody: (typeName, duration) => `Votre <strong style="color:${PALETTE.text}">${typeName}</strong> (${duration} min) est confirmé.`,
    when: "Quand",
    context: "Contexte",
    join: "Rejoindre la réunion",
    reschedule: "Replanifier",
    cancel: "Annuler le rendez-vous",
    cancelledHeadline: "Rendez-vous annulé.",
    cancelledBody: (name, typeName) => `Bonjour ${name}, votre ${typeName} a été annulé. Le créneau est libéré — vous pouvez réserver un nouveau rendez-vous quand vous le souhaitez.`,
    rescheduledHeadline: "Créneau replanifié.",
    rescheduledBody: (name, typeName, date, time, tz) => `Bonjour ${name}, votre ${typeName} aura lieu le <strong style="color:${PALETTE.text}">${date}</strong> à <strong style="color:${PALETTE.text}">${time}</strong> (${tz}).`,
    manage: "Gérer le rendez-vous",
    subjectConfirmed: (typeName) => `Confirmé : ${typeName} avec ${PRODUCT_CONFIG.name}`,
    subjectCancelled: `Rendez-vous annulé — ${PRODUCT_CONFIG.mark}`,
    subjectRescheduled: (typeName) => `Replanifié : ${typeName} avec ${PRODUCT_CONFIG.name}`
  }
};

function c(locale) {
  return locale === "fr" ? COPY.fr : COPY.en;
}

function shell(headline, innerHtml) {
  return `<!DOCTYPE html><html><body style="font-family:Inter,Arial,sans-serif;background:${PALETTE.bg};color:${PALETTE.text};margin:0;padding:40px 0;">
  <div style="max-width:480px;margin:0 auto;background:${PALETTE.card};border:1px solid ${PALETTE.border};border-radius:16px;overflow:hidden;">
    <div style="padding:28px 28px 20px;">
      <div style="font-family:'Space Grotesk',Arial,sans-serif;font-size:11px;letter-spacing:0.14em;color:${PALETTE.faint};text-transform:uppercase;">${COPY.en.brand}</div>
      <h1 style="margin:10px 0 0;font-family:Fraunces,Georgia,serif;font-size:26px;letter-spacing:-0.01em;color:${PALETTE.text};font-weight:500;">${headline}</h1>
    </div>
    <div style="padding:4px 28px 28px;">${innerHtml}</div>
  </div></body></html>`;
}

function whenBlock(date, time, tzLabel, locale) {
  const L = c(locale);
  return `<div style="background:${PALETTE.bg};border:1px solid ${PALETTE.border};border-radius:12px;padding:16px;margin-bottom:20px;">
    <div style="font-size:11px;letter-spacing:0.14em;color:${PALETTE.faint};text-transform:uppercase;margin-bottom:6px;">${L.when}</div>
    <div style="color:${PALETTE.text};font-size:16px;font-weight:500;">${date} · ${time}</div>
    <div style="color:${PALETTE.muted};font-size:13px;margin-top:2px;">${tzLabel}</div>
  </div>`;
}

function btn(href, label, primary) {
  if (primary) {
    return `<a href="${href}" style="display:block;text-align:center;background:${PALETTE.accent};color:#FFFFFF;text-decoration:none;padding:13px;border-radius:10px;font-weight:600;font-size:14px;margin-bottom:10px;">${label}</a>`;
  }
  return `<a href="${href}" style="display:block;text-align:center;background:${PALETTE.card};border:1px solid ${PALETTE.border};color:${PALETTE.text};text-decoration:none;padding:12px;border-radius:10px;font-size:13px;margin-bottom:8px;">${label}</a>`;
}

function cancelLink(href, label) {
  return `<a href="${href}" style="display:block;text-align:center;color:${PALETTE.faint};text-decoration:none;padding:8px;font-size:12px;">${label}</a>`;
}

export function confirmationEmail(locale, { name, typeName, duration, date, time, tzLabel, context, meetingUrl, manageUrl, cancelUrl }) {
  const L = c(locale);
  let inner = `<p style="margin:0 0 8px;color:${PALETTE.text};font-size:15px;">${L.confirmedIntro(name)}</p>`;
  inner += `<p style="margin:0 0 20px;color:${PALETTE.muted};font-size:14px;line-height:1.6;">${L.confirmedBody(typeName, duration)}</p>`;
  inner += whenBlock(date, time, tzLabel, locale);
  if (context) {
    inner += `<div style="font-size:11px;letter-spacing:0.14em;color:${PALETTE.faint};text-transform:uppercase;margin:0 0 6px;">${L.context}</div><div style="color:${PALETTE.text};font-size:14px;margin-bottom:20px;">${context}</div>`;
  }
  if (meetingUrl) inner += btn(meetingUrl, L.join, true);
  inner += btn(manageUrl, L.reschedule, false);
  inner += cancelLink(cancelUrl, L.cancel);
  return { subject: L.subjectConfirmed(typeName), body: shell(L.confirmedHeadline, inner) };
}

export function cancellationEmail(locale, { name, typeName }) {
  const L = c(locale);
  const inner = `<p style="margin:0 0 8px;color:${PALETTE.text};font-size:15px;">${L.confirmedIntro(name)}</p>
    <p style="margin:0;color:${PALETTE.muted};font-size:14px;line-height:1.6;">${L.cancelledBody(name, typeName)}</p>`;
  return { subject: L.subjectCancelled, body: shell(L.cancelledHeadline, inner) };
}

export function rescheduleEmail(locale, { name, typeName, date, time, tzLabel, meetingUrl, manageUrl }) {
  const L = c(locale);
  let inner = `<p style="margin:0 0 8px;color:${PALETTE.text};font-size:15px;">${L.confirmedIntro(name)}</p>`;
  inner += `<p style="margin:0 0 20px;color:${PALETTE.muted};font-size:14px;line-height:1.6;">${L.rescheduledBody(name, typeName, date, time, tzLabel)}</p>`;
  if (meetingUrl) inner += btn(meetingUrl, L.join, true);
  inner += btn(manageUrl, L.manage, false);
  return { subject: L.subjectRescheduled(typeName), body: shell(L.rescheduledHeadline, inner) };
}
