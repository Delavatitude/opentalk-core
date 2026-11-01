export function linkUsable(link, now = Date.now()) {
  return !!link && link.active !== false && (!link.valid_from || Date.parse(link.valid_from)<=now) && (!link.valid_until || Date.parse(link.valid_until)>=now);
}
export function publicLink(link) {
  // Explicit allowlist: never serialize Contact IDs, notes or invitation mail payloads.
  return {id:link.id,slug:link.slug,title:link.title || "",context:link.context || "",booking_context:link.booking_context || "",booking_type_id:link.booking_type_id || "",booking_page_id:link.booking_page_id || "",company:link.company || "",contact_name:link.contact_name || "",contact_email:link.contact_email || "",contact_phone:link.contact_phone || "",locale:link.locale || "",timezone:link.timezone || ""};
}
