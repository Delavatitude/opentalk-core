import {env} from "../../env.ts";
import { EMAIL_CONFIG } from "../../shared/emailConfig.ts";
import {createClientFromRequest} from "../../context.ts";
import {allRows,upsertContact,safeAttachBookingContact,refreshContact,normalizeEmail,cleanText} from "../../shared/contacts.ts";
import {contextsFor,CONTEXTS} from "../../shared/contexts.ts";
import {escapeHtml} from "../../shared/notificationTemplates.ts";
import {validatePageType} from "../../shared/bookingPages.ts";
import {linkUsable} from "../../shared/bookingLinks.ts";
export default async function(req) {
  try {
    const platform=createClientFromRequest(req), user=await platform.auth.me();
    if(user?.role!=="admin")return Response.json({error:"crm_forbidden"},{status:403});
    const db=platform.asServiceRole.entities, body=await req.json(), action=body.action || "list";
    if(action==="list") {
      // Reconcile legacy records and retry failed CRM attachments without sending emails.
      const bookings=await allRows(db.Booking);
      for(const b of bookings) if(!b.contact_id || b.crm_sync_status==="pending") await safeAttachBookingContact(db,b);
      const contacts=(await allRows(db.Contact)).filter(c=>!c.merged_into);
      return Response.json({contacts});
    }
    if(action==="save") {
      if(body.contact?.id) {
        const old=await db.Contact.get(body.contact.id);
        if(normalizeEmail(old.email)!==normalizeEmail(body.contact.email))return Response.json({error:"crm_email_locked"},{status:400});
      }
      const contact=await upsertContact(db,body.contact || {},{manual:true});
      return Response.json({contact});
    }
    if(action==="detail") {
      let contact=await db.Contact.get(body.contact_id);
      if(contact.merged_into)contact=await db.Contact.get(contact.merged_into);
      await refreshContact(db,contact.id);
      contact=await db.Contact.get(contact.id);
      const bookings=await allRows(db.Booking,{contact_id:contact.id});
      const links=await allRows(db.BookingLink,{contact_id:contact.id});
      return Response.json({contact,bookings,links:links.map(l=>({id:l.id,slug:l.slug,title:l.title,invitation_status:l.invitation_status,invitation_error:l.invitation_error,invitation_sent_at:l.invitation_sent_at,active:l.active}))});
    }
    if(action==="generate_link") {
      const contact=await db.Contact.get(body.contact_id);
      const type=await db.BookingType.get(body.booking_type_id);
      const page=body.booking_page_id?await validatePageType(db,body.booking_page_id,type.id):null;
      const context=page?.context_key || (CONTEXTS.includes(body.context)?body.context:"general");
      if(!type?.active || (!page && !contextsFor(type).includes(context)))return Response.json({error:"crm_invalid_type"},{status:400});
      const settings=await db.Setting.filter({});
      const appBase=settings.find(s=>s.key==="app_base_url")?.value;
      if(!appBase || !/^https:\/\//.test(appBase))return Response.json({error:"crm_base_url_required"},{status:400});
      const slug=crypto.randomUUID().replaceAll("-","");
      const link=await db.BookingLink.create({slug,booking_page_id:page?.id || "",title:type["name_"+contact.locale] || type.name,context:cleanText(body.subject,2000),booking_context:context,booking_type_id:type.id,contact_id:contact.id,contact_name:contact.full_name,contact_email:contact.email,contact_phone:contact.phone || "",company:contact.company || "",locale:contact.locale || "en",timezone:contact.timezone || "UTC",active:true,valid_until:new Date(Date.now()+30*86400000).toISOString(),invitation_status:"not_sent"});
      return Response.json({link:{id:link.id,url:appBase.replace(/\/$/,"")+"/e/"+slug+"?lang="+link.locale,status:link.invitation_status}});
    }
    if(action==="send_link") {
      const link=await db.BookingLink.get(body.link_id);
      if(!link.contact_id || !linkUsable(link))return Response.json({error:"crm_link_expired"},{status:400});
      if(link.invitation_status==="sent")return Response.json({status:"sent"});
      const apiKey=env("RESEND_API_KEY"),from=(env("RESEND_FROM")?.trim() || EMAIL_CONFIG.from);
      const settings=await db.Setting.filter({}),appBase=settings.find(s=>s.key==="app_base_url")?.value;
      if(!apiKey || !from || !appBase || !/^https:\/\//.test(appBase)) {
        await db.BookingLink.update(link.id,{invitation_status:"pending_configuration",invitation_error:"crm_email_setup"});
        return Response.json({status:"pending_configuration"});
      }
      if(link.invitation_attempt_at && Date.now()-Date.parse(link.invitation_attempt_at)>23*3600000) {
        await db.BookingLink.update(link.id,{invitation_status:"review_required",invitation_error:"crm_email_review"});
        return Response.json({status:"review_required"});
      }
      const fr=link.locale==="fr", url=appBase.replace(/\/$/,"")+"/e/"+link.slug+"?lang="+(fr?"fr":"en");
      const greeting=(fr?"Bonjour ":"Hello ")+link.contact_name+",";
      const title=fr?"Choisissons un créneau.":"Let’s find a time.";
      const intro=fr?"Choisissez le créneau qui vous convient pour notre échange.":"Pick a time that works for you.";
      const label=fr?"Choisir un créneau":"Choose a time";
      const text=[greeting,intro,link.title,link.context,url].filter(Boolean).join("\n\n");
      const html='<html lang="'+(fr?"fr":"en")+'"><body style="background:#f6f2ea;color:#2d2822;font-family:Arial,sans-serif;padding:24px"><div style="max-width:560px;margin:auto;background:#fffdfa;padding:28px"><p>OPEN / TALK · '+escapeHtml((link.booking_context || "general").toUpperCase())+'</p><h1 style="font-family:Georgia,serif">'+escapeHtml(title)+'</h1><p>'+escapeHtml(greeting)+'</p><p>'+escapeHtml(intro)+'</p><h2>'+escapeHtml(link.title)+'</h2><p>'+escapeHtml(link.context)+'</p><p><a style="color:#a75f43" href="'+escapeHtml(url)+'">'+escapeHtml(label)+'</a></p></div></body></html>';
      const payload=link.invitation_payload || JSON.stringify({from,to:[link.contact_email],subject:title+" · "+link.title,text,html});
      await db.BookingLink.update(link.id,{invitation_status:"sending",invitation_payload:payload,invitation_attempt_at:link.invitation_attempt_at || new Date().toISOString(),invitation_error:""});
      try {
        const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+apiKey,"Content-Type":"application/json","Idempotency-Key":"booking-invitation/"+link.id},body:payload,signal:AbortSignal.timeout(15000)});
        const result=await response.json();
        if(!response.ok || !result.id)throw new Error("crm_email_failed");
        await db.BookingLink.update(link.id,{invitation_status:"sent",invitation_message_id:result.id,invitation_sent_at:new Date().toISOString(),invitation_error:""});
        return Response.json({status:"sent"});
      } catch {
        await db.BookingLink.update(link.id,{invitation_status:"failed",invitation_error:"crm_email_failed"});
        return Response.json({status:"failed"});
      }
    }
    return Response.json({error:"crm_invalid_action"},{status:400});
  } catch(error) {
    const key=String(error.message || "");
    return Response.json({error:key.startsWith("crm_")?key:"crm_error"},{status:400});
  }
}
