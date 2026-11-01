import {publicBody, publicFailure} from "../../shared/publicInput.ts";
import {syncGoogleCalendars} from "../../shared/googleCalendars.ts";
import {syncWixBooking,wixBusy} from "../../shared/wixCalendar.ts";
import { createClientFromRequest } from "../../context.ts";
import { safeNotify } from "../../shared/notifications.ts";
import { safeAttachBookingContact } from "../../shared/contacts.ts";
import { waitUntil } from "../../runtime.ts";

export default async function(req) {
  try {
    const body = await publicBody(req, "cancel");
    const platform = createClientFromRequest(req);
    const { token } = body;
    if (!token) return Response.json({ error: "Token required" }, { status: 400 });

    const all = await platform.asServiceRole.entities.Booking.filter({$or:[{reschedule_token:token},{cancel_token:token}]}, "-created_date", 2);
    const booking = all.find(b => b.cancel_token === token || b.reschedule_token === token);
    if (!booking) return Response.json({ error: "Booking not found" }, { status: 404 });
    if (booking.status === "cancelled") { const googleSync=await syncGoogleCalendars(platform,booking.id); const wixSync=await syncWixBooking(platform,booking.id); return Response.json({ok:true,alreadyCancelled:true,calendar_sync_status:googleSync.status,wix_sync_status:wixSync.status}); }

    const updated = await platform.asServiceRole.entities.Booking.update(booking.id, { status: "cancelled", calendar_sync_status: "pending", notification_revision: new Date().toISOString() + "|" + crypto.randomUUID() });
    const googleSync = await syncGoogleCalendars(platform, booking.id);
    const wixSync = await syncWixBooking(platform, booking.id);
    const settings = await platform.asServiceRole.entities.Setting.filter({});
    waitUntil(safeAttachBookingContact(platform.asServiceRole.entities, { ...booking, ...updated }));
    waitUntil(safeNotify(platform, { ...booking, ...updated }, "cancelled", settings));

    return Response.json({ ok: true, calendar_sync_status:googleSync.status, wix_sync_status: wixSync.status });
  } catch (error) {
    return publicFailure(error);
  }
}
