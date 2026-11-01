import {env} from "../env.ts";
import { Resend } from 'resend';

// Shared server-only configuration. Never import this module from src/.
import { EMAIL_CONFIG } from "./emailConfig.ts";
export { EMAIL_CONFIG };
const secret = () => env("RESEND_API_KEY");
export function getResendClient() {
  const key = secret();
  if (!key) return null;
  const client = new Resend(key, {baseUrl:"https://api.resend.com"});
  // This pinned SDK logs raw provider errors in development. Keep all diagnostics
  // in our sanitized EmailLog instead, without changing global console behavior.
  Object.defineProperty(client, "logError", {value: () => {}});
  return client;
}
export function safeResendError(error) {
  const names = ["validation_error","missing_api_key","invalid_api_key","restricted_api_key","rate_limit_exceeded","daily_quota_exceeded","monthly_quota_exceeded","invalid_idempotency_key","invalid_idempotent_request","concurrent_idempotent_requests","application_error","internal_server_error"];
  return names.includes(error?.name) ? "resend_" + error.name : "email_send_failed";
}
export async function sendTransactionalEmail(platform, args) {
  const db = platform.asServiceRole.entities;
  const recipient = String(args.to || "").trim().toLowerCase();
  const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  if (!validEmail(recipient) || (args.replyTo && !validEmail(args.replyTo))) return {success:false,status:"failed",error:"email_invalid_recipient"};
  const key = args.idempotencyKey;
  if (!key || key.length > 256) return {success:false,status:"failed",error:"email_invalid_key"};
  const logs = await db.EmailLog.filter({dedupe_key:key},"created_date",100);
  const sent = logs.find(l=>l.status==="sent");
  if (sent) return {success:true,status:"sent",provider_message_id:sent.provider_message_id,log_id:sent.id};
  let log = logs[0];
  if(!log) log = await db.EmailLog.create({
    ...(args.bookingId ? {booking_id:args.bookingId}:{}),
    ...(args.contactId ? {contact_id:args.contactId}:{}),
    ...(args.bookingLinkId ? {booking_link_id:args.bookingLinkId}:{}),
    recipient,email_type:args.emailType,locale:args.locale || "en",provider:"resend",
    status:"pending",dedupe_key:key,created_at:new Date().toISOString(),
    revision:args.revision || "",start_at:args.startAt || ""
  });
  const fail = async(status,error) => {
    await db.EmailLog.update(log.id,{status,error,error_message:error});
    return {success:false,status,error,log_id:log.id};
  };
  if(log.status==="review_required") return {success:false,status:"review_required",error:"email_review_required",log_id:log.id};
  const client = getResendClient();
  if(!client) return fail("pending_configuration","email_secret_missing");
  if(log.first_attempt_at && Date.now()-Date.parse(log.first_attempt_at)>=23*3600000) return fail("review_required","email_review_required");
  const payload = log.payload_json ? JSON.parse(log.payload_json) : {
    from: args.testMode ? EMAIL_CONFIG.testFrom : (env("RESEND_FROM") || EMAIL_CONFIG.from),
    to:[recipient],subject:args.subject,html:args.html,
    ...(args.text ? {text:args.text}:{}),...(args.replyTo ? {replyTo:args.replyTo}:{})
  };
  await db.EmailLog.update(log.id,{status:"sending",payload_json:JSON.stringify(payload),first_attempt_at:log.first_attempt_at || new Date().toISOString(),attempt_count:(log.attempt_count || 0)+1,error:"",error_message:""});
  let result;
  try {
    const {data,error} = await client.emails.send(payload,{idempotencyKey:key});
    if(error) return await fail("failed",safeResendError(error));
    if(!data?.id) return await fail("failed","email_missing_message_id");
    result = {success:true,status:"sent",provider_message_id:data.id,log_id:log.id};
  } catch {
    return await fail("failed","email_send_failed");
  }
  // Keep a provider-accepted send distinguishable from a database logging failure.
  try {
    await db.EmailLog.update(log.id,{status:"sent",provider_message_id:result.provider_message_id,sent_at:new Date().toISOString(),error:"",error_message:""});
  } catch {
    return {success:false,status:"sending",error:"email_log_update_failed",log_id:log.id};
  }
  return result;
}
