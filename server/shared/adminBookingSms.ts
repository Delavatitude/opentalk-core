import {env} from "../env.ts";
import { PRODUCT_CONFIG } from "./productConfig.ts";

// Server-only SMS Partner integration.
// API: https://www.docpartner.dev/en/api/sms-partner/send-sms/single-send
export function normalizeSmsPhone(value) {
  let phone=String(value || "").replace(/[\s().-]/g,"");
  if(phone.startsWith("00"))phone="+"+phone.slice(2);
  if(/^0[67]\d{8}$/.test(phone))phone="+33"+phone.slice(1);
  return /^\+[1-9]\d{7,14}$/.test(phone)?phone:null;
}
export function smsConfirmation(booking, kind = "rescheduled") {
  const fr=booking.locale==="fr",tz=booking.timezone || PRODUCT_CONFIG.defaultTimezone;
  const date=new Intl.DateTimeFormat(fr?"fr-FR":"en-GB",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false,timeZone:tz}).format(new Date(booking.start_at));
  return (PRODUCT_CONFIG.name + " - "+(kind==="cancelled"?(fr?"Rendez-vous annule du ":"Appointment cancelled for "):(fr?"Rendez-vous deplace au ":"Appointment rescheduled to "))+date+" ("+tz+").").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^\x20-\x7E]/g," ");
}
// Called once, only by createBooking for the newly created booking. No automatic
// retry: this provider does not document an idempotency key for single sends.
export async function sendAdminBookingSms(platform,booking,kind) {
  const db=platform.asServiceRole.entities;

  try {
    const fresh=await db.Booking.get(booking.id);
    if(fresh.notification_revision!==booking.notification_revision || fresh.status!==(kind==="cancelled"?"cancelled":"rescheduled") || !["pending","pending_configuration"].includes(fresh.sms_status))return;
    const phone=normalizeSmsPhone(fresh.phone);
    if(!phone){await db.Booking.update(fresh.id,{sms_status:"failed",sms_error:"sms_invalid_phone"});return;}
    const apiKey=env("SMS_PARTNER_API_KEY");
    if(!apiKey){await db.Booking.update(fresh.id,{sms_status:"pending_configuration",sms_error:"sms_secret_missing"});return;}
    const message=smsConfirmation(fresh,kind);
    await db.Booking.update(fresh.id,{sms_status:"sending",sms_error:""});
    let result;
    try {
      const response=await fetch("https://api.smspartner.fr/v1/send",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({apiKey,phoneNumbers:phone,sender:PRODUCT_CONFIG.smsSender,message}),
        signal:AbortSignal.timeout(15000)
      });
      result=await response.json();
      if(!response.ok || result.success!==true || !result.message_id) {
        await db.Booking.update(fresh.id,{sms_status:response.status>=500?"review_required":"failed",sms_error:"sms_provider_rejected"});return;
      }
    } catch {
      await db.Booking.update(fresh.id,{sms_status:"review_required",sms_error:"sms_send_uncertain"});return;
    }
    await db.Booking.update(fresh.id,{sms_status:"accepted",sms_provider_message_id:String(result.message_id),sms_sent_at:new Date().toISOString(),sms_error:""});
  } catch {
    // A provider or persistence failure must never invalidate the booking.
  }
}
