import { zonedToUTC, zonedDate, localDayBounds } from "./time.ts";

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

// Core availability engine.
// All inputs use UTC ISO strings / ms epochs. Returns array of { start_at, end_at } UTC ISO.
export async function computeAvailability(params) {
  const {
    bookingType,
    availabilityRules,
    blockedPeriods,
    existingBookings,
    calendarBusy,
    referenceTimezone,
    now,
    dateRange
  } = params;

  const durationMin = bookingType.duration;
  const bufferBeforeMin = bookingType.buffer_before || 0;
  const bufferAfterMin = bookingType.buffer_after || 0;
  const minNoticeMs = (bookingType.minimum_notice_minutes || 0) * 60000;
  const earliest = new Date(now.getTime() + minNoticeMs);
  const maxFuture = new Date(now.getTime() + ((bookingType.booking_window_days || 30) + 1) * 86400000);
  const maxPerDay = bookingType.max_per_day || 999;
  if (!Number.isFinite(durationMin) || durationMin < 1 || durationMin > 1440) throw new RangeError("Invalid booking duration");
  const stepMs = durationMin * 60000;

  // Build busy ranges (UTC ms) from all sources.
  const busyRanges = [];
  for (const e of calendarBusy) {
    busyRanges.push({ start: new Date(e.start).getTime(), end: new Date(e.end).getTime() });
  }
  for (const b of blockedPeriods) {
    busyRanges.push({ start: new Date(b.start_at).getTime(), end: new Date(b.end_at).getTime() });
  }
  for (const b of existingBookings) {
    if (b.status === "cancelled") continue;
    const bStart = new Date(b.start_at).getTime();
    const bEnd = new Date(b.end_at).getTime();
    const bb = (b.buffer_before != null ? b.buffer_before : bufferBeforeMin) * 60000;
    const ba = (b.buffer_after != null ? b.buffer_after : bufferAfterMin) * 60000;
    busyRanges.push({ start: bStart - bb, end: bEnd + ba });
  }

  // Count confirmed bookings per day (reference tz).
  const dayCounts = {};
  for (const b of existingBookings) {
    if (b.status === "cancelled") continue;
    const d = zonedDate(b.start_at, referenceTimezone);
    dayCounts[d] = (dayCounts[d] || 0) + 1;
  }

  const slots = [];
  for (const day of dateRange) {
    const bounds = localDayBounds(day.date, referenceTimezone);
    if (new Date(bounds.end) <= now) continue;
    if (new Date(bounds.start) > maxFuture) continue;
    if ((dayCounts[day.date] || 0) >= maxPerDay) continue;

    const rules = availabilityRules.filter(
      r => r.day_of_week === day.dayOfWeek &&
        (!r.booking_type_id || r.booking_type_id === bookingType.id)
    );

    for (const rule of rules) {
      const ruleTz = rule.timezone || referenceTimezone;
      let rangeStart, rangeEnd;
      try {
        rangeStart = zonedToUTC(day.date, rule.start_time, ruleTz);
        rangeEnd = zonedToUTC(day.date, rule.end_time, ruleTz);
      } catch (error) {
        if (error instanceof RangeError) continue; // A rule boundary in a DST gap offers no slots.
        throw error;
      }
      let cursor = rangeStart.getTime();
      while (true) {
        const slotStart = cursor;
        const slotEnd = cursor + stepMs;
        if (slotEnd > rangeEnd.getTime()) break;
        if (slotStart >= earliest.getTime()) {
          const blockStart = slotStart - bufferBeforeMin * 60000;
          const blockEnd = slotEnd + bufferAfterMin * 60000;
          const conflict = busyRanges.some(r => overlaps(blockStart, blockEnd, r.start, r.end));
          if (!conflict) {
            slots.push({ start_at: new Date(slotStart).toISOString(), end_at: new Date(slotEnd).toISOString() });
          }
        }
        cursor += stepMs;
      }
    }
  }
  return slots;
}

// Check that an exact requested slot is in the computed availability for its day.
export async function isSlotAvailable(params) {
  const { requestedStartISO, requestedEndISO, ...rest } = params;
  const singleDayRange = [{
    date: zonedDate(requestedStartISO, params.referenceTimezone),
    dayOfWeek: await dayOfWeekFor(requestedStartISO, params.referenceTimezone)
  }];
  const slots = await computeAvailability({ ...rest, dateRange: singleDayRange });
  return slots.some(s => s.start_at === requestedStartISO && s.end_at === requestedEndISO);
}

function dayOfWeekFor(iso, tz) {
  const dateStr = zonedDate(iso, tz);
  const noon = zonedToUTC(dateStr, "12:00", tz);
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(noon);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
}
