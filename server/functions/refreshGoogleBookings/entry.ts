import {createClientFromRequest} from "../../context.ts";
import {importGoogleBooking} from "../../shared/googleBookingImport.ts";
export default async function(req){
 try{
  const client=createClientFromRequest(req),user=await client.auth.me().catch(()=>null);
  if(user?.role!=="admin")return Response.json({error:"crm_forbidden"},{status:403});
  const {booking_ids}=await req.json();
  if(!Array.isArray(booking_ids)||!booking_ids.length||booking_ids.length>5||booking_ids.some(id=>typeof id!=="string"||id.length>100))return Response.json({error:"external_sync_limit"},{status:400});
  const bookings=await client.asServiceRole.entities.Booking.filter({id:{$in:[...new Set(booking_ids)]}},"id",5);
  const {accessToken}=await client.asServiceRole.connectors.getConnection("googlecalendar");
  const results=[];
  for(const booking of bookings){
   const result=await importGoogleBooking(client,booking,accessToken);results.push(result);
   if(result.status==="external_sync_rate_limit")break;
  }
  return Response.json({results});
 }catch{return Response.json({error:"external_sync_failed"},{status:500});}
}
