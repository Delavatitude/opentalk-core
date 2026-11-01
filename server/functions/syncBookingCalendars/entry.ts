import {createClientFromRequest} from "../../context.ts";
import {syncGoogleCalendars} from "../../shared/googleCalendars.ts";
import {syncWixBooking} from "../../shared/wixCalendar.ts";
export default async function(req){
 const platform=createClientFromRequest(req);
 try{
  const body=await req.json();let admin=false;try{admin=(await platform.auth.me())?.role==="admin";}catch{}
  const entity=platform.asServiceRole.entities.Booking;let booking;
  if(admin && typeof body.booking_id==="string")booking=await entity.get(body.booking_id);
  else if(typeof body.token==="string" && body.token.length>=30)booking=(await entity.filter({reschedule_token:body.token}))[0];
  if(!booking)return Response.json({error:"crm_forbidden"},{status:403});
  // Repair only this authorized booking, including cancelled secondary Google mirrors.
  if(!Array.isArray(booking.google_calendar_events))return Response.json({error:"calendar_retry_unavailable"},{status:400});
  const google=await syncGoogleCalendars(platform,booking.id,fetch,{notifyEmail:false}),wix=await syncWixBooking(platform,booking.id);
  return Response.json({success:["synced","disabled"].includes(google.status) && wix.success,google:google.status,wix:wix.status});
 }catch{return Response.json({success:false,error:"calendar_sync_failed"},{status:500});}
}
