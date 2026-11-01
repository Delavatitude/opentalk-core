// Shared validation before database reads or provider calls.
export class InputError extends Error {}
export function validDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
export function validTimezone(value) {
  if (typeof value !== "string" || value.length > 100) return false;
  try { new Intl.DateTimeFormat("en", {timeZone:value}).format(); return true; } catch { return false; }
}
export async function publicBody(req, action) {
  if (req.method !== "POST") throw new InputError("invalid_request");
  const reader = req.body?.getReader();
  if (!reader) throw new InputError("invalid_request");
  let text = "", size = 0;
  const decoder = new TextDecoder();
  try {
    while (true) {
      const {value, done} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) { await reader.cancel(); throw new InputError("request_too_large"); }
      text += decoder.decode(value, {stream:true});
    }
    text += decoder.decode();
  } finally { reader.releaseLock(); }
  let body;
  try { body = JSON.parse(text); } catch { throw new InputError("invalid_request"); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new InputError("invalid_request");
  const limits = {booking_type_id:100, booking_type_slug:120, booking_page_id:100, booking_link_id:100, name:200, email:254, company:200, context:120, phone:80, source:80, topic:2000, token:200};
  for (const [key, max] of Object.entries(limits)) if (body[key] != null && (typeof body[key] !== "string" || body[key].length > max)) throw new InputError("invalid_request");
  if (body.timezone != null && !validTimezone(body.timezone)) throw new InputError("invalid_timezone");
  if (action === "availability") {
    if (body.days != null && (!Number.isInteger(body.days) || body.days < 1 || body.days > 31)) throw new InputError("invalid_days");
    if (body.start_date != null && !validDate(body.start_date)) throw new InputError("invalid_date");
  }
  if (action === "create" || action === "move") {
    const keys = action === "create" ? ["start_at", "end_at"] : ["new_start_at", "new_end_at"];
    for (const key of keys) if (typeof body[key] !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(body[key]) || !Number.isFinite(Date.parse(body[key])) || new Date(body[key]).toISOString().slice(0,19) !== body[key].slice(0,19)) throw new InputError("invalid_datetime");
    const duration = Date.parse(body[keys[1]]) - Date.parse(body[keys[0]]);
    if (duration <= 0 || duration > 86400000) throw new InputError("invalid_duration");
  }
  return body;
}
export function publicFailure(error) {
  if (error?.status === 409) return Response.json({error:"booking_conflict"},{status:409});
  if (!(error instanceof InputError)) console.error("public_endpoint_failed", error?.name || "Error");
  return Response.json({error:error instanceof InputError ? error.message : "service_unavailable"}, {status:error instanceof InputError ? 400 : 500, headers:{"Cache-Control":"no-store"}});
}
