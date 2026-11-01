import {publicBody, publicFailure} from "../../shared/publicInput.ts";
import {googleBusy} from "../../shared/googleBusy.ts";
import {syncGoogleCalendars} from "../../shared/googleCalendars.ts";
import {syncWixBooking,wixBusy} from "../../shared/wixCalendar.ts";
import { createClientFromRequest } from "../../context.ts";
import { computeAvailability } from "../../shared/availability.ts";
import { zonedDate, zonedTime, timezoneLabel, formatDateDisplay, localDayBounds, zonedWeekday } from "../../shared/time.ts";
import {phoneProfile} from "../../shared/phone.ts";
import {sendBookingSms,normalizeSmsPhone} from "../../shared/smsPartner.ts";
import { safeNotify } from "../../shared/notifications.ts";
import { CONTEXTS, contextsFor } from "../../shared/contexts.ts";
import { safeAttachBookingContact, normalizeEmail } from "../../shared/contacts.ts";
import { linkUsable } from "../../shared/bookingLinks.ts";
import {validatePageType,findPage} from "../../shared/bookingPages.ts";
import { waitUntil } from "../../runtime.ts";

export default async function(req) {
  try {
    const body = await publicBody(req, "create");
    const platform = createClientFromRequest(req);
    let isAdmin=false;try{isAdmin=(await platform.auth.me())?.role==="admin";}catch{}
    const notifyEmail = isAdmin ? body.notify_email !== false : true;
    const notifySms = isAdmin && body.notify_sms === true;
    if(notifySms && !normalizeSmsPhone(body.phone)) return Response.json({error:"booking_sms_phone"},{status:400});

    const { booking_type_id, start_at, end_at, name, email: inputEmail, company, context, timezone, booking_link_id, source } = body;
    const email = normalizeEmail(inputEmail);
    body.email = email;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) return Response.json({error:"crm_invalid_email"},{status:400});
    let invitation=null;
    if (booking_link_id) {
      const link = await platform.asServiceRole.entities.BookingLink.get(booking_link_id);
      invitation=link;
      if(link.booking_page_id && body.booking_page_id && link.booking_page_id!==body.booking_page_id)return Response.json({error:"pages_unavailable"},{status:400});
      if (!linkUsable(link) || (link.booking_type_id && link.booking_type_id !== booking_type_id) || (link.booking_context && link.booking_context !== context)) return Response.json({error:"crm_link_expired"},{status:400});
    }
    let bookingLocale = body.locale === "fr" ? "fr" : "en";
    if (!booking_type_id || !start_at || !end_at || !name || !email) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const bookingType = await platform.asServiceRole.entities.BookingType.get(booking_type_id);
    if (!bookingType || !bookingType.active) {
      return Response.json({ error: "Booking type not available" }, { status: 404 });
    }
    let pageId=invitation?.booking_page_id || body.booking_page_id;
    let page=null;
    if(pageId)page=await validatePageType(platform.asServiceRole.entities,pageId,booking_type_id);
    else {
      // Old manual admin flows remain available; public callers must resolve a published page.
      if(!isAdmin){
        const fallback=await findPage(platform.asServiceRole.entities,{slug:context==="general"?"/":context || "/"});
        if(!fallback)return Response.json({error:"pages_unavailable"},{status:404});
        page=await validatePageType(platform.asServiceRole.entities,fallback.id,booking_type_id);pageId=page.id;
      }
    }
    const bookingContext = page?.context_key || (CONTEXTS.includes(context)?context:"general");
    if (!page && !contextsFor(bookingType).includes(bookingContext)) return Response.json({ error: "Booking type unavailable for this context" }, { status: 400 });
    if(invitation?.booking_context && invitation.booking_context!==bookingContext)return Response.json({error:"pages_unavailable"},{status:400});
    if(page?.language_mode==="fr" || page?.language_mode==="en")bookingLocale=page.language_mode;
    const topic = String(body.topic || "").slice(0, 2000);
    const revision = new Date().toISOString() + "|" + crypto.randomUUID();
    const override=page?.type_overrides?.find(o=>o.booking_type_id===booking_type_id);
    const typeName = override?.[`name_${bookingLocale}`] || bookingType[`name_${bookingLocale}`] || bookingType.name;

    const settings = await platform.asServiceRole.entities.Setting.filter({});
    const refTz = (settings.find(s => s.key === "reference_timezone")?.value) || "UTC";
    const appBase = (settings.find(s => s.key === "app_base_url")?.value) || new URL(req.url).origin;

    // Re-validate the slot against live availability (double-booking prevention).
    const dateStr = zonedDate(start_at, refTz);
    const dayOfWeek = zonedWeekday(dateStr, refTz);

    const allRules = await platform.asServiceRole.entities.AvailabilityRule.filter({ active: true });
    const rules = allRules.filter(r => !r.booking_type_id || r.booking_type_id === bookingType.id);

    const {start:dayStart, end:dayEnd} = localDayBounds(dateStr, refTz);
    const allBlocked = await platform.asServiceRole.entities.BlockedPeriod.filter({});
    const blockedIn = allBlocked.filter(b => new Date(b.end_at) >= new Date(dayStart) && new Date(b.start_at) <= new Date(dayEnd));
    const allBookings = await platform.asServiceRole.entities.Booking.filter({ status: { $in: ["confirmed", "rescheduled"] } });
    const bookingsIn = allBookings.filter(b => new Date(b.end_at) >= new Date(dayStart) && new Date(b.start_at) <= new Date(dayEnd));
    const allTypes = await platform.asServiceRole.entities.BookingType.filter({});
    const typeMap = {};
    for (const t of allTypes) typeMap[t.id] = t;
    const enrichedBookings = bookingsIn.map(b => ({
      ...b, buffer_before: b._buffer_before ?? typeMap[b.booking_type_id]?.buffer_before ?? 0, buffer_after: b._buffer_after ?? typeMap[b.booking_type_id]?.buffer_after ?? 0
    }));

    let calendarBusy;
    try { calendarBusy=await googleBusy(platform, dayStart, dayEnd); }
    catch { return Response.json({error:"Calendar availability is temporarily unavailable. Please retry.",code:"google_availability_unavailable"},{status:503}); }

    // Revalidate against every external Wix calendar, including Apple/iOS.
    try { calendarBusy.push(...await wixBusy(platform, dayStart, dayEnd)); }
    catch { return Response.json({error:"Calendar availability is temporarily unavailable. Please retry.",code:"wix_availability_unavailable"},{status:503}); }

    const slots = await computeAvailability({
      bookingType, availabilityRules: rules, blockedPeriods: blockedIn,
      existingBookings: enrichedBookings, calendarBusy, referenceTimezone: refTz,
      now: new Date(), dateRange: [{ date: dateStr, dayOfWeek }]
    });

    const valid = slots.some(s => s.start_at === start_at && s.end_at === end_at);
    if (!valid) {
      return Response.json({ error: "This slot is no longer available. Please pick another time." }, { status: 409 });
    }

    const cancelToken = crypto.randomUUID();
    const rescheduleToken = crypto.randomUUID();

    let meetingUrl = bookingType.location_value || null;

    const booking = await platform.asServiceRole.entities.Booking.create({
      booking_type_id, booking_type_name: typeName, booking_page_id:pageId || "",context_key:bookingContext,
      name, email: body.email, email_normalized: body.email, ...phoneProfile(String(body.phone || "").trim().slice(0,80)), company, context: bookingContext, topic, duration: bookingType.duration,
      wix_sync_status: "pending",
      crm_sync_status: "pending",
      notify_email: notifyEmail, notify_sms: notifySms, sms_status: notifySms ? "pending" : "disabled",
      notification_revision: revision, calendar_sync_status: "pending",
      start_at, end_at, timezone: timezone || "UTC",
      locale: bookingLocale,
      status: "confirmed",
      meeting_url: meetingUrl,
      cancel_token: cancelToken, reschedule_token: rescheduleToken,
      booking_link_id: booking_link_id || "",
      location_type: bookingType.location_type, location_value: bookingType.location_value || "",
      source: source || "direct"
    });

    const googleSync = await syncGoogleCalendars(platform, booking.id);
    meetingUrl = googleSync.meeting_url;
    booking.meeting_url = meetingUrl;
    const wixSync = await syncWixBooking(platform, booking.id);
    await safeAttachBookingContact(platform.asServiceRole.entities, booking);
    const tz = timezone || refTz;
    waitUntil(safeNotify(platform, booking, "confirmation", settings));
    if(notifySms) waitUntil(sendBookingSms(platform, booking));

    return Response.json({
      booking: {
        id: booking.id, name, email, company, context, calendar_sync_status:googleSync.status, wix_sync_status: wixSync.status,
        start_at, end_at, timezone: tz, locale: bookingLocale,
        booking_type_name: typeName, duration: bookingType.duration,
        meeting_url: meetingUrl, reschedule_token: rescheduleToken, cancel_token: cancelToken
      }
    });
  } catch (error) {
    return publicFailure(error);
  }
}
