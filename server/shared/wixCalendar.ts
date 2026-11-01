// Optional Wix calendar adapter. The booking app remains the source of truth.
import {env} from "../env.ts";
const wixEnv = (key: string) => env(key)?.trim() || "";
export const WIX_SITE_ID = wixEnv("WIX_SITE_ID");
export const WIX_SCHEDULE_ID = wixEnv("WIX_SCHEDULE_ID");
export const WIX_RESOURCE_ID = wixEnv("WIX_RESOURCE_ID");
const wixConfigured = () => !!(WIX_SITE_ID && WIX_SCHEDULE_ID && WIX_RESOURCE_ID);

export function wixRequest(platform) {
  let tokenPromise;
  return async (path, method = "GET", body = undefined) => {
    tokenPromise ||= platform.asServiceRole.connectors.getConnection("wix");
    const {accessToken} = await tokenPromise;
    const response = await fetch("https://www.wixapis.com" + path, {
      method, headers: {Authorization: accessToken, "wix-site-id": WIX_SITE_ID, "Content-Type":"application/json"},
      ...(body === undefined ? {} : {body:JSON.stringify(body)}), signal:AbortSignal.timeout(20000)
    });
    if (!response.ok) {
      const error = new Error(response.status === 401 || response.status === 403 ? "wix_permission_error" : "wix_sync_failed");
      error.status = response.status;
      throw error;
    }
    return response.status === 204 ? {} : response.json();
  };
}
export async function wixKey(id) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("opentalk:wix:" + id)));
  bytes[6] = (bytes[6] & 15) | 80; bytes[8] = (bytes[8] & 63) | 128;
  const h = [...bytes.slice(0,16)].map(v=>v.toString(16).padStart(2,"0")).join("");
  return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join("-");
}
export function wixEventBody(booking) {
  return {
    scheduleId: WIX_SCHEDULE_ID, type:"DEFAULT", timeZone:"UTC", transparency:"OPAQUE",
    title: ("[OpenTalk · " + (booking.context || "general") + "] " + booking.booking_type_name + " · " + booking.name).slice(0,200),
    start:{localDate:new Date(booking.start_at).toISOString().slice(0,19)},
    end:{localDate:new Date(booking.end_at).toISOString().slice(0,19)},
    notes: "OpenTalk booking: " + booking.id + "\nManage this appointment in OpenTalk."
  };
}
export async function syncWixBooking(platform, bookingId, request = undefined) {
  if (!request && !wixConfigured()) return {success:true,status:"disabled"};
  request ||= wixRequest(platform);
  const entity = platform.asServiceRole.entities.Booking;
  let booking = await entity.get(bookingId);
  try {
    // Always reload desired state; never replay an old event payload from a background job.
    let event;
    if (booking.wix_event_id) {
      event = (await request("/calendar/v3/events/" + encodeURIComponent(booking.wix_event_id))).event;
    } else if (booking.status !== "cancelled" || booking.wix_create_attempted) {
      await entity.update(booking.id,{wix_sync_status:"pending",wix_create_attempted:true});
      event = (await request("/calendar/v3/events","POST",{event:wixEventBody(booking),idempotencyKey:await wixKey(booking.id)})).event;
      if (!event?.id) throw new Error("wix_sync_failed");
      await entity.update(booking.id,{wix_event_id:event.id});
    }
    booking = await entity.get(bookingId);
    if (event && booking.status === "cancelled" && event.status !== "CANCELLED") {
      event = (await request("/calendar/v3/events/" + encodeURIComponent(event.id) + "/cancel","POST",{participantNotification:{notifyParticipants:false}})).event;
    } else if (event && booking.status !== "cancelled") {
      if (event.status === "CANCELLED") throw new Error("wix_event_cancelled");
      const desired = wixEventBody(booking);
      if (Date.parse(event.start?.utcDate) !== Date.parse(booking.start_at) || Date.parse(event.end?.utcDate) !== Date.parse(booking.end_at) || event.title !== desired.title) {
        const {scheduleId,type,...patch} = desired;
        event = (await request("/calendar/v3/events/" + encodeURIComponent(event.id),"PATCH",{event:{...patch,revision:event.revision}})).event;
      }
    }
    const now = new Date().toISOString();
    await entity.update(booking.id,{wix_sync_status:"synced",wix_sync_error:"",wix_synced_at:now,wix_event_id:event?.id || booking.wix_event_id || ""});
    return {success:true,status:"synced",synced_at:now};
  } catch (error) {
    const code = ["wix_permission_error","wix_event_cancelled"].includes(error.message) ? error.message : "wix_sync_failed";
    await entity.update(bookingId,{wix_sync_status:"failed",wix_sync_error:code});
    return {success:false,status:"failed",error:code};
  }
}
export async function wixBusy(platform, from, to, excludeEventId = "", request = undefined) {
  if (!request && !wixConfigured()) return [];
  request ||= wixRequest(platform);
  const events = [];
  let cursor;
  do {
    const data = await request("/calendar/v3/events/query","POST",{
      fromLocalDate:new Date(from).toISOString().slice(0,19),toLocalDate:new Date(to).toISOString().slice(0,19),timeZone:"UTC",
      query:{cursorPaging:{limit:1000,...(cursor?{cursor}:{})}}
    });
    events.push(...(data.events || []));
    const next = data.pagingMetadata?.cursors?.next;
    if(data.pagingMetadata?.hasNext && (!next || next===cursor)) throw new Error("wix_sync_failed");
    cursor = data.pagingMetadata?.hasNext ? next : undefined;
  } while(cursor);
  const busy = events.filter(e => e.id !== excludeEventId && e.status !== "CANCELLED" && e.type !== "WORKING_HOURS" &&
    ((e.scheduleId===WIX_SCHEDULE_ID && e.transparency!=="TRANSPARENT") ||
    e.resources?.some(r=>r.id===WIX_RESOURCE_ID && r.transparency!=="TRANSPARENT")))
    .map(e=>({start:e.start?.utcDate,end:e.end?.utcDate}));
  // External (Apple) events aren't included in Calendar V3 queries.
  cursor = undefined;
  do {
    // Query every external-calendar connection on the Wix site. Filtering by the
    // Ignore the mirror schedule when reading busy calendars connected to another Wix schedule.
    const params = new URLSearchParams({from,to,"cursorPaging.limit":"1000"});
    if(cursor)params.set("cursorPaging.cursor",cursor);
    const data = await request("/bookings/v2/external-calendars/events?" + params);
    if(data.failedProviderIds?.length)throw new Error("wix_sync_failed");
    busy.push(...(data.events || []).map(e=>({start:e.start,end:e.end})));
    const next = data.pagingMetadata?.cursors?.next;
    if(data.pagingMetadata?.hasNext && (!next || next===cursor))throw new Error("wix_sync_failed");
    cursor = data.pagingMetadata?.hasNext ? next : undefined;
  } while(cursor);
  if(busy.some(b=>!Number.isFinite(Date.parse(b.start)) || !Number.isFinite(Date.parse(b.end))))throw new Error("wix_sync_failed");
  return busy;
}
