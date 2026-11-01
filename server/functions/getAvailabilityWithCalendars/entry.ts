import {publicBody, publicFailure} from "../../shared/publicInput.ts";
import {googleBusy} from "../../shared/googleBusy.ts";
import {syncWixBooking,wixBusy} from "../../shared/wixCalendar.ts";
import { createClientFromRequest } from "../../context.ts";
import { computeAvailability } from "../../shared/availability.ts";
import { zonedTime, zonedDate, zonedWeekday, timezoneLabel, weekdayShort, localDayBounds } from "../../shared/time.ts";

export default async function(req) {
  try {
    const body = await publicBody(req, "availability");
    const platform = createClientFromRequest(req);

    const bookingTypeId = body.booking_type_id;
    const bookingTypeSlug = body.booking_type_slug;
    const startDate = body.start_date;
    const days = body.days ?? 14;
    const visitorTimezone = body.timezone || "UTC";
    const locale = body.locale === "fr" ? "fr" : "en";

    let bookingType;
    if (bookingTypeId) {
      bookingType = await platform.asServiceRole.entities.BookingType.get(bookingTypeId);
    } else if (bookingTypeSlug) {
      const found = await platform.asServiceRole.entities.BookingType.filter({ slug: bookingTypeSlug });
      bookingType = found[0];
    } else {
      return Response.json({ error: "booking_type_id or booking_type_slug required" }, { status: 400 });
    }
    if (!bookingType || !bookingType.active) {
      return Response.json({ error: "Booking type not available" }, { status: 404 });
    }

    const settings = await platform.asServiceRole.entities.Setting.filter({});
    const refTz = (settings.find(s => s.key === "reference_timezone")?.value) || "UTC";

    const now = new Date();
    const todayRef = zonedDate(now.toISOString(), refTz);
    const startStr = startDate || todayRef;

    const dateRange = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(startStr + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      dateRange.push({
        date: dateStr,
        dayOfWeek: zonedWeekday(dateStr, refTz),
        dayLabel: weekdayShort(dateStr, locale),
        dayNumber: Number(dateStr.slice(8, 10))
      });
    }

    const allRules = await platform.asServiceRole.entities.AvailabilityRule.filter({ active: true });
    const rules = allRules.filter(r => !r.booking_type_id || r.booking_type_id === bookingType.id);

    const rangeStartISO = localDayBounds(dateRange[0].date, refTz).start;
    const rangeEndISO = localDayBounds(dateRange[dateRange.length - 1].date, refTz).end;

    const allBlocked = await platform.asServiceRole.entities.BlockedPeriod.filter({});
    const blockedIn = allBlocked.filter(b => new Date(b.end_at) >= new Date(rangeStartISO) && new Date(b.start_at) <= new Date(rangeEndISO));

    const allBookings = await platform.asServiceRole.entities.Booking.filter({ status: { $in: ["confirmed", "rescheduled"] } });
    const bookingsIn = allBookings.filter(b => new Date(b.end_at) >= new Date(rangeStartISO) && new Date(b.start_at) <= new Date(rangeEndISO));

    // Enrich bookings with their type buffers.
    const allTypes = await platform.asServiceRole.entities.BookingType.filter({});
    const typeMap = {};
    for (const t of allTypes) typeMap[t.id] = t;
    const enrichedBookings = bookingsIn.map(b => {
      const t = typeMap[b.booking_type_id];
      return {
        ...b,
        buffer_before: t ? t.buffer_before : 0,
        buffer_after: t ? t.buffer_after : 0
      };
    });

    // Fetch Google free/busy and every external Wix calendar, including Apple/iOS.
    let calendarBusy;
    try { calendarBusy=await googleBusy(platform, rangeStartISO, rangeEndISO); }
    catch { return Response.json({error:"Calendar availability is temporarily unavailable. Please retry.",code:"google_availability_unavailable"},{status:503}); }

    try { calendarBusy.push(...await wixBusy(platform, rangeStartISO, rangeEndISO)); }
    catch { return Response.json({error:"Calendar availability is temporarily unavailable. Please retry.",code:"wix_availability_unavailable"},{status:503}); }

    const slots = await computeAvailability({
      bookingType,
      availabilityRules: rules,
      blockedPeriods: blockedIn,
      existingBookings: enrichedBookings,
      calendarBusy,
      referenceTimezone: refTz,
      now,
      dateRange
    });

    const byDate = {};
    for (const s of slots) {
      const d = zonedDate(s.start_at, refTz);
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push({ start_at: s.start_at, end_at: s.end_at, label: zonedTime(s.start_at, visitorTimezone, locale) });
    }

    const resultDays = dateRange.map(d => ({
      date: d.date, dayLabel: d.dayLabel, dayNumber: d.dayNumber, slots: byDate[d.date] || []
    }));

    return Response.json({
      timezone: visitorTimezone,
      timezoneLabel: timezoneLabel(visitorTimezone),
      referenceTimezone: refTz,
      bookingType: {
        id: bookingType.id, name: bookingType[`name_${locale}`] || bookingType.name, slug: bookingType.slug,
        duration: bookingType.duration,
        buffer_before: bookingType.buffer_before, buffer_after: bookingType.buffer_after
      },
      locale,
      days: resultDays
    });
  } catch (error) {
    return publicFailure(error);
  }
}
