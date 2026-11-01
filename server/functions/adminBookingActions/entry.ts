import {createClientFromRequest} from "../../context.ts";
import {syncGoogleCalendars,googleBusyForReschedule} from "../../shared/googleCalendars.ts";
import {syncWixBooking,wixBusy} from "../../shared/wixCalendar.ts";
import {computeAvailability} from "../../shared/availability.ts";
import {zonedDate} from "../../shared/time.ts";
import {safeNotify} from "../../shared/notifications.ts";
import {sendAdminBookingSms,normalizeSmsPhone} from "../../shared/adminBookingSms.ts";
import {refreshContact} from "../../shared/contacts.ts";
export default async function(req) {
 try {
  const platform=createClientFromRequest(req);
  const user=await platform.auth.me().catch(()=>null);
  if(user?.role!=="admin")return Response.json({error:"crm_forbidden"},{status:403});
  const body=await req.json(),db=platform.asServiceRole.entities;
  if(!body.booking_id || !["slots","move","delete","log_call"].includes(body.action))return Response.json({error:"admin_booking_invalid"},{status:400});
  let booking=await db.Booking.get(body.booking_id);
  if(!booking)return Response.json({error:"not_found"},{status:404});
  if(body.action==="log_call"){
   const patch={call_outcome:["pending","completed","missed","postponed","no_show"].includes(body.call_outcome)?body.call_outcome:"pending",call_transcript:body.call_transcript||"",call_summary:body.call_summary||"",call_logged_at:new Date().toISOString()};
   const updated=await db.Booking.update(booking.id,patch);
   return Response.json({ok:true,booking:updated});
  }
  const email=body.notify_email===true,sms=body.notify_sms===true,sync=body.sync_calendars!==false;
  if(body.action!=="slots" && sms && !normalizeSmsPhone(booking.phone))return Response.json({error:"phone_invalid"},{status:400});
  if(body.action==="delete"){
   if(!booking.deletion_pending){
    booking={...booking,...await db.Booking.update(booking.id,{status:"cancelled",deletion_pending:true,cancel_token:"",reschedule_token:"",notification_revision:new Date().toISOString()+"|"+crypto.randomUUID(),sms_status:sms?"pending":"disabled"})};
    const settings=await db.Setting.filter({});
    if(email)await safeNotify(platform,booking,"cancelled",settings,true);
    if(sms)await sendAdminBookingSms(platform,booking,"cancelled");
   }
   // Cleanup is mandatory even when updates were skipped on an earlier move.
   const google=await syncGoogleCalendars(platform,booking.id,fetch,{notifyEmail:email});
   const wix=await syncWixBooking(platform,booking.id);
   if(!["synced","disabled"].includes(google.status) || !["synced","disabled"].includes(wix.status))
    return Response.json({ok:false,error:"admin_booking_delete_pending"});
   const notificationWarning=await notificationIssue(db,booking,email,sms);
   await db.Booking.delete(booking.id);
   if(booking.contact_id)try{await refreshContact(db,booking.contact_id);}catch{}
   return Response.json({ok:true,deleted:true,warning:notificationWarning});
  }
  if(booking.status==="cancelled" || booking.deletion_pending)return Response.json({error:"admin_booking_cancelled"},{status:409});
  const bookingType=await db.BookingType.get(booking.booking_type_id);
  if(!bookingType?.active)return Response.json({error:"crm_invalid_type"},{status:400});
    const settings = await platform.asServiceRole.entities.Setting.filter({});
    const refTz = (settings.find(s => s.key === "reference_timezone")?.value) || "UTC";
    const appBase = (settings.find(s => s.key === "app_base_url")?.value) || new URL(req.url).origin;

    // An administrator may choose any valid time. Keep the appointment duration,
    // but do not apply public availability rules or conflict checks.
    if(body.action==="move"){
      const newStartMs=Date.parse(body.new_start_at);
      const durationMs=Date.parse(booking.end_at)-Date.parse(booking.start_at);
      if(!Number.isFinite(newStartMs) || !Number.isFinite(durationMs) || durationMs<=0)return Response.json({error:"admin_booking_datetime"},{status:400});
      if(body.expected_start_at!==booking.start_at)return Response.json({error:"admin_booking_changed"},{status:409});
      const newStart=new Date(newStartMs).toISOString();
      const newEnd=new Date(newStartMs+durationMs).toISOString();
      if(newStart===booking.start_at && newEnd===booking.end_at)return Response.json({ok:true});
      booking={...booking,...await db.Booking.update(booking.id,{start_at:newStart,end_at:newEnd,status:"rescheduled",notification_revision:new Date().toISOString()+"|"+crypto.randomUUID(),sms_status:sms?"pending":"disabled",calendar_sync_status:sync?"pending":"skipped",wix_sync_status:sync?"pending":"skipped"})};
      const google=sync?await syncGoogleCalendars(platform,booking.id,fetch,{notifyEmail:email}):{status:"skipped"};
      const wix=sync?await syncWixBooking(platform,booking.id):{status:"skipped"};
      if(email)await safeNotify(platform,booking,"rescheduled",settings,true);
      if(sms)await sendAdminBookingSms(platform,booking,"rescheduled");
      if(booking.contact_id)try{await refreshContact(db,booking.contact_id);}catch{}
      const notificationWarning=await notificationIssue(db,booking,email,sms);
      return Response.json({ok:true,warning:sync && (!(["synced","disabled"].includes(google.status)) || !(["synced","disabled"].includes(wix.status)))?"calendar_sync_failed":notificationWarning});
    }

    // Slot discovery remains available for older clients, but is not required for admin moves.
    const dateStr = body.date || zonedDate(body.new_start_at, refTz);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(dateStr))return Response.json({error:"admin_booking_date"},{status:400});
    const noon = new Date(dateStr + "T12:00:00Z");
    const wd = new Intl.DateTimeFormat("en-US", { timeZone: refTz, weekday: "short" }).format(noon);
    const dayOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);

    const allRules = await platform.asServiceRole.entities.AvailabilityRule.filter({ active: true });
    const rules = allRules.filter(r => !r.booking_type_id || r.booking_type_id === bookingType.id);
    const dayStart = dateStr + "T00:00:00Z";
    const dayEnd = dateStr + "T23:59:59Z";
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



  if(body.action==="slots")return Response.json({slots,timezone:refTz});
  if(!slots.some(s=>s.start_at===body.new_start_at && s.end_at===body.new_end_at))return Response.json({error:"admin_booking_conflict"},{status:409});
  if(body.expected_start_at!==booking.start_at)return Response.json({error:"admin_booking_changed"},{status:409});
  if(body.new_start_at===booking.start_at && body.new_end_at===booking.end_at)return Response.json({ok:true});
  booking={...booking,...await db.Booking.update(booking.id,{start_at:body.new_start_at,end_at:body.new_end_at,status:"rescheduled",notification_revision:new Date().toISOString()+"|"+crypto.randomUUID(),sms_status:sms?"pending":"disabled",calendar_sync_status:sync?"pending":"skipped",wix_sync_status:sync?"pending":"skipped"})};
  const google=sync?await syncGoogleCalendars(platform,booking.id,fetch,{notifyEmail:email}):{status:"skipped"};
  const wix=sync?await syncWixBooking(platform,booking.id):{status:"skipped"};
  if(email)await safeNotify(platform,booking,"rescheduled",settings,true);
  if(sms)await sendAdminBookingSms(platform,booking,"rescheduled");
  if(booking.contact_id)try{await refreshContact(db,booking.contact_id);}catch{}
  const notificationWarning=await notificationIssue(db,booking,email,sms);
  return Response.json({ok:true,warning:sync && (![ "synced","disabled"].includes(google.status) || !["synced","disabled"].includes(wix.status))?"calendar_sync_failed":notificationWarning});
 }catch(e){return Response.json({error:e?.status===409?"admin_booking_conflict":"crm_error"}, {status:e?.status===409?409:500});}
}
async function notificationIssue(db,booking,email,sms){
 try{
  if(sms && (await db.Booking.get(booking.id)).sms_status!=="accepted")return "booking_notification_issue";
  if(email){
   const logs=await db.EmailLog.filter({booking_id:booking.id,revision:booking.notification_revision});
   if(!logs.some(l=>l.status==="sent"))return "booking_notification_issue";
  }
  return "";
 }catch{return "booking_notification_issue";}
}
