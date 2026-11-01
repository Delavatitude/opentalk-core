import {publicBody, publicFailure} from "../../shared/publicInput.ts";
import {syncGoogleCalendars,googleBusyForReschedule} from "../../shared/googleCalendars.ts";
import {syncWixBooking,wixBusy} from "../../shared/wixCalendar.ts";
import { createClientFromRequest } from "../../context.ts";
import { computeAvailability } from "../../shared/availability.ts";
import { zonedDate, zonedTime, timezoneLabel, formatDateDisplay, localDayBounds, zonedWeekday } from "../../shared/time.ts";
import { safeNotify } from "../../shared/notifications.ts";
import { safeAttachBookingContact } from "../../shared/contacts.ts";
import { waitUntil } from "../../runtime.ts";

export default async function(req) {
  try {
    const body = await publicBody(req, "move");
    const platform = createClientFromRequest(req);
    const { token, new_start_at, new_end_at } = body;
    if (!token || !new_start_at || !new_end_at) return Response.json({ error: "token, new_start_at, new_end_at required" }, { status: 400 });

    const all = await platform.asServiceRole.entities.Booking.filter({$or:[{reschedule_token:token},{cancel_token:token}]}, "-created_date", 2);
    const booking = all.find(b => b.reschedule_token === token || b.cancel_token === token);
    if (!booking) return Response.json({ error: "Booking not found" }, { status: 404 });
    if (booking.status === "cancelled") return Response.json({ error: "Booking is cancelled" }, { status: 400 });

    const bookingType = await platform.asServiceRole.entities.BookingType.get(booking.booking_type_id);
    if (!bookingType) return Response.json({ error: "Booking type not found" }, { status: 404 });

    const settings = await platform.asServiceRole.entities.Setting.filter({});
    const refTz = (settings.find(s => s.key === "reference_timezone")?.value) || "UTC";
    const appBase = (settings.find(s => s.key === "app_base_url")?.value) || new URL(req.url).origin;

    // Validate the new slot, excluding the current booking.
    const dateStr = zonedDate(new_start_at, refTz);
    const dayOfWeek = zonedWeekday(dateStr, refTz);

    const allRules = await platform.asServiceRole.entities.AvailabilityRule.filter({ active: true });
    const rules = allRules.filter(r => !r.booking_type_id || r.booking_type_id === bookingType.id);
    const {start:dayStart, end:dayEnd} = localDayBounds(dateStr, refTz);
    const allBlocked = await platform.asServiceRole.entities.BlockedPeriod.filter({});
    const blockedIn = allBlocked.filter(b => new Date(b.end_at) >= new Date(dayStart) && new Date(b.start_at) <= new Date(dayEnd));
    const allBookings = await platform.asServiceRole.entities.Booking.filter({ status: { $in: ["confirmed", "rescheduled"] } });
    const otherBookings = allBookings.filter(b => b.id !== booking.id && new Date(b.end_at) >= new Date(dayStart) && new Date(b.start_at) <= new Date(dayEnd));
    const allTypes = await platform.asServiceRole.entities.BookingType.filter({});
    const typeMap = {};
    for (const t of allTypes) typeMap[t.id] = t;
    const enriched = otherBookings.map(b => ({ ...b, buffer_before: b._buffer_before ?? typeMap[b.booking_type_id]?.buffer_before ?? 0, buffer_after: b._buffer_after ?? typeMap[b.booking_type_id]?.buffer_after ?? 0 }));

    let calendarBusy;
    try{calendarBusy=await googleBusyForReschedule(platform,booking,dayStart,dayEnd);}
    catch{return Response.json({error:"Calendar availability is temporarily unavailable. Please retry."},{status:503});}

    // Revalidate against every external Wix calendar, including Apple/iOS.
    try { calendarBusy.push(...await wixBusy(platform, dayStart, dayEnd, booking.wix_event_id || "")); }
    catch { return Response.json({error:"Calendar availability is temporarily unavailable. Please retry.",code:"wix_availability_unavailable"},{status:503}); }

    const slots = await computeAvailability({
      bookingType, availabilityRules: rules, blockedPeriods: blockedIn,
      existingBookings: enriched, calendarBusy, referenceTimezone: refTz,
      now: new Date(), dateRange: [{ date: dateStr, dayOfWeek }]
    });
    const valid = slots.some(s => s.start_at === new_start_at && s.end_at === new_end_at);
    if (!valid) return Response.json({ error: "This slot is no longer available." }, { status: 409 });

    const updated = await platform.asServiceRole.entities.Booking.update(booking.id, { start_at: new_start_at, end_at: new_end_at, status: "rescheduled", notification_revision: new Date().toISOString() + "|" + crypto.randomUUID(), calendar_sync_status: "pending" });

    const googleSync = await syncGoogleCalendars(platform, booking.id);
    const wixSync = await syncWixBooking(platform, booking.id);
    const tz = booking.timezone || refTz;
    const locale = booking.locale === "fr" ? "fr" : "en";
    const typeName = bookingType[`name_${locale}`] || bookingType.name;
    const manageUrl = `${appBase}/m/${booking.reschedule_token}`;
    const dateDisplay = formatDateDisplay(new_start_at, tz, locale);
    const timeDisplay = zonedTime(new_start_at, tz, locale);
    waitUntil(safeAttachBookingContact(platform.asServiceRole.entities, { ...booking, ...updated }));
    waitUntil(safeNotify(platform, { ...booking, ...updated }, "rescheduled", settings));

    return Response.json({
      ok: true, calendar_sync_status:googleSync.status, wix_sync_status: wixSync.status,
      booking: { start_at: new_start_at, end_at: new_end_at, dateDisplay, timeDisplay, tzLabel: timezoneLabel(tz), locale }
    });
  } catch (error) {
    return publicFailure(error);
  }
}
