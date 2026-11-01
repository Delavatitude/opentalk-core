import {createClientFromRequest} from "../../context.ts";
import {syncWixBooking} from "../../shared/wixCalendar.ts";
export default async function(req) {
 const platform=createClientFromRequest(req);
 try {
  const body=await req.json();
  let admin=false;try{admin=(await platform.auth.me())?.role==="admin";}catch{}
  const entity=platform.asServiceRole.entities.Booking;
  let bookings;
  if(admin)bookings=body.booking_id?[await entity.get(body.booking_id)]:await entity.filter({});
  else {
   if(typeof body.token!=="string" || body.token.length<30)return Response.json({error:"crm_forbidden"},{status:403});
   bookings=await entity.filter({reschedule_token:body.token});
   if(!bookings.length)return Response.json({error:"crm_forbidden"},{status:403});
  }
  const results=[];
  for(const b of bookings.filter(b=>b.wix_event_id || b.wix_create_attempted || new Date(b.end_at)>=new Date()))results.push(await syncWixBooking(platform,b.id));
  return Response.json({success:results.every(r=>r.success),synced:results.filter(r=>r.success).length,failed:results.filter(r=>!r.success).length,results});
 } catch{return Response.json({success:false,error:"wix_sync_failed"},{status:500});}
}
