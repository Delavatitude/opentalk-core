import { createClientFromRequest } from "../../context.ts";
import { safeNotify, reminderDue, reminderEnabled } from "../../shared/notifications.ts";
export default async function(req) {
  const platform = createClientFromRequest(req);
  const user = await platform.auth.me();
  if (user?.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
  const db = platform.asServiceRole.entities;
  const settings = await db.Setting.filter({});
  const types = await db.BookingType.filter({});
  let checked = 0, offset = 0;
  while (true) {
    const bookings = await db.Booking.filter({}, "created_date", 100, offset);
    for (const booking of bookings) {
      checked++;
      // Reconcile recent lifecycle changes even when initial log persistence failed.
      if (booking.notification_revision && Date.now() - Date.parse(booking.notification_revision.split("|")[0]) < 23 * 3600000) {
        await safeNotify(platform, booking, booking.status === "cancelled" ? "cancelled" : booking.status === "rescheduled" ? "rescheduled" : "confirmation", settings);
      }
      if (booking.status === "cancelled") continue;
      const type = types.find(t => t.id === booking.booking_type_id);
      for (const [key, hours] of [["reminder_24h", 24], ["reminder_1h", 1]]) {
        if (reminderEnabled(type, settings, key) && reminderDue(booking, hours)) await safeNotify(platform, booking, key, settings);
      }
    }
    if (bookings.length < 100) break;
    offset += bookings.length;
  }
  // Retry only previously queued lifecycle emails, respecting the current revision.
  const pending = await db.EmailLog.filter({ status: { $in: ["pending", "pending_configuration", "failed", "sending"] }, email_type: { $in: ["confirmation", "rescheduled", "cancelled", "reminder_24h", "reminder_1h"] } }, "created_date", 100);
  for (const log of pending) {
    const booking = await db.Booking.get(log.booking_id);
    if ((booking.notification_revision || booking.start_at) !== log.revision) {
      await db.EmailLog.update(log.id, { status: "skipped", error: "Superseded booking revision" }); continue;
    }
    await safeNotify(platform, booking, log.email_type, settings);
  }
  return Response.json({ ok: true, checked });
}
