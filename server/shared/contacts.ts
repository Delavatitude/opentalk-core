import {phoneProfile} from "./phone.ts";
export const normalizeEmail = v => String(v || "").trim().toLowerCase();
export const cleanText = (v, max = 500) => String(v || "").trim().slice(0, max);
export function profile(input) {
  const email = normalizeEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("crm_invalid_email");
  const full_name = cleanText(input.full_name || input.name || [input.first_name, input.last_name].filter(Boolean).join(" "));
  if (!full_name) throw new Error("crm_name_required");
  const pieces = full_name.split(/\s+/);
  const timezone = cleanText(input.timezone || "UTC", 100);
  try { new Intl.DateTimeFormat("en", {timeZone:timezone}); } catch { throw new Error("crm_invalid_timezone"); }
  return {email, full_name, first_name:cleanText(input.first_name || pieces[0]),last_name:cleanText(input.last_name || pieces.slice(1).join(" ")),...phoneProfile(cleanText(input.phone,80)),company:cleanText(input.company),locale:input.locale === "fr" ? "fr" : "en",timezone};
}
export async function allRows(entity, query = {}) {
  let out = [], skip = 0;
  for (;;) {const rows = await entity.filter(query,"created_date",100,skip);out.push(...rows);if(rows.length<100)return out;skip+=rows.length;}
}
export function bookingSummary(bookings) {
  const sorted = [...bookings].sort((a,b)=>Date.parse(a.start_at)-Date.parse(b.start_at));
  const last = sorted.at(-1);
  return { total_bookings: sorted.length, first_booking_at:sorted[0]?.start_at || "", last_booking_at:last?.start_at || "", last_booking_type:last?.booking_type_name || "",last_meeting_url:last?.meeting_url || "",contexts:[...new Set(sorted.map(b=>b.context_key || b.context).filter(Boolean))] };
}
export async function upsertContact(db, input, options = {}) {
  const data = profile(input);
  let matches = await allRows(db.Contact,{email:data.email});
  if (!matches.length) {
    await db.Contact.create({...data,status:"lead",notes:"",tags:[],total_bookings:0,created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
    matches = await allRows(db.Contact,{email:data.email});
  }
  // Deterministic reconciliation also covers simultaneous first bookings.
  matches.sort((a,b)=>String(a.created_date || a.created_at).localeCompare(String(b.created_date || b.created_at)) || a.id.localeCompare(b.id));
  const canonical=matches[0];
  if(!canonical) throw new Error("crm_sync_failed");
  const patch = {updated_at:new Date().toISOString()};
  const timestamp = options.profileAt || new Date().toISOString();
  if (!canonical.profile_updated_at || Date.parse(timestamp) >= Date.parse(canonical.profile_updated_at)) {
    Object.assign(patch,data,{profile_updated_at:timestamp});
    if(!options.manual) {
      if(!data.phone) {delete patch.phone;delete patch.phone_country;delete patch.phone_calling_code;}
      if(!data.company) delete patch.company;
    }
  }
  if(options.manual) {
    patch.notes=cleanText(input.notes,10000);
    patch.tags=Array.isArray(input.tags)?input.tags.map(v=>cleanText(v,60)).filter(Boolean).slice(0,30):[];
    patch.status=["lead","active_client","partner","inactive"].includes(input.status)?input.status:(canonical.status || "lead");
    patch.context=cleanText(input.context || canonical.context || "general",40);
    patch.source=canonical.source || "manual";
  }
  const duplicateNotes=matches.slice(1).filter(c=>!c.merged_into).map(c=>c.notes).filter(Boolean);
  if(duplicateNotes.length && !options.manual) patch.notes=[canonical.notes,...duplicateNotes].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join("\n\n");
  const unmerged=matches.slice(1).filter(c=>!c.merged_into);
  if(unmerged.length) patch.tags=[...new Set([...(patch.tags || canonical.tags || []),...unmerged.flatMap(c=>c.tags || [])])];
  await db.Contact.update(canonical.id,patch);
  for(const duplicate of matches.slice(1)) {
    await db.Contact.update(duplicate.id,{merged_into:canonical.id});
    await db.Booking.updateMany({contact_id:duplicate.id},{$set:{contact_id:canonical.id}});
  }
  return {...canonical,...patch};
}
export async function refreshContact(db, contactId) {
  const contact=await db.Contact.get(contactId);
  const bookings=await allRows(db.Booking,{contact_id:contactId});
  const summary=bookingSummary(bookings);
  await db.Contact.update(contactId,{...summary,contexts:[...new Set([...(summary.contexts || []),contact.context].filter(Boolean))],updated_at:new Date().toISOString()});
}
export async function attachBookingContact(db, booking) {
  let contact=await upsertContact(db,booking,{profileAt:booking.created_date || booking.created_at || new Date().toISOString()});
  await db.Booking.update(booking.id,{contact_id:contact.id,email_normalized:normalizeEmail(booking.email),crm_sync_status:"synced"});
  const fresh=await db.Contact.get(contact.id);
  if(fresh.merged_into) {
    contact=await db.Contact.get(fresh.merged_into);
    await db.Booking.update(booking.id,{contact_id:contact.id});
  }
  if(!contact.context) await db.Contact.update(contact.id,{context:booking.context || "general",source:booking.source || "booking"});
  await refreshContact(db,contact.id);
  return contact.id;
}
export async function safeAttachBookingContact(db, booking) {
  try {return await attachBookingContact(db,booking);}
  catch {try {await db.Booking.update(booking.id,{crm_sync_status:"pending"});} catch {} console.error("CRM synchronization pending",booking.id);}
}
