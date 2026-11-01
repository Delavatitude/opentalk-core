import {publicBody, publicFailure} from "../../shared/publicInput.ts";
import { createClientFromRequest } from "../../context.ts";
import { zonedTime, formatDateDisplay, timezoneLabel } from "../../shared/time.ts";

export default async function(req) {
  try {
    const body = await publicBody(req, "lookup");
    const platform = createClientFromRequest(req);
    const { token } = body;
    if (!token) return Response.json({ error: "Token required" }, { status: 400 });

    const all = await platform.asServiceRole.entities.Booking.filter({$or:[{cancel_token:token},{reschedule_token:token}]}, "-created_date", 2);
    const booking = all.find(b => b.cancel_token === token || b.reschedule_token === token);
    if (!booking) return Response.json({ error: "Booking not found" }, { status: 404 });

    const settings = await platform.asServiceRole.entities.Setting.filter({});
    const refTz = (settings.find(s => s.key === "reference_timezone")?.value) || "UTC";
    const tz = booking.timezone || refTz;
    const locale = booking.locale === "fr" ? "fr" : "en";

    return Response.json({
      booking: {
        id: booking.id,
        name: booking.name, email: booking.email, company: booking.company, context: booking.context,
        start_at: booking.start_at, end_at: booking.end_at,
        timezone: tz,
        locale,
        dateDisplay: formatDateDisplay(booking.start_at, tz, locale),
        timeDisplay: zonedTime(booking.start_at, tz, locale),
        tzLabel: timezoneLabel(tz),
        booking_type_name: booking.booking_type_name,
        booking_type_id: booking.booking_type_id,
        duration: booking.duration,
        meeting_url: booking.meeting_url,
        location_type: booking.location_type,
        location_value: booking.location_value,
        status: booking.status,
        is_cancel_token: booking.cancel_token === token,
        is_reschedule_token: booking.reschedule_token === token,
        // Do not return another bearer credential. The current token supports management.
      }
    }, {headers:{"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
  } catch (error) {
    return publicFailure(error);
  }
}
