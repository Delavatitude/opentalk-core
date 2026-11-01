import {createClientFromRequest} from "../../context.ts";
import {wixRequest,wixBusy,WIX_SCHEDULE_ID} from "../../shared/wixCalendar.ts";
export default async function(req) {
 const platform=createClientFromRequest(req);
 try {
  if((await platform.auth.me())?.role!=="admin")return Response.json({error:"crm_forbidden"},{status:403});
  const request=wixRequest(platform), now=new Date(), to=new Date(now.getTime()+86400000);
  const data=await request("/bookings/v2/external-calendars/connections");
  // Validate all external Wix connections, including Apple/iOS.
  const busy=await wixBusy(platform,now.toISOString(),to.toISOString(),"",request);
  let bookings=[],offset=0;
  for(;;){const page=await platform.asServiceRole.entities.Booking.filter({},"-created_date",100,offset);bookings.push(...page);if(page.length<100)break;offset+=page.length;}
  const relevant=bookings.filter(b=>new Date(b.end_at)>=now || (b.wix_event_id && b.wix_sync_status!=="synced"));
  return Response.json({success:true,site:"configured-wix-site",synced:relevant.filter(b=>b.wix_sync_status==="synced").length,pending:relevant.filter(b=>b.wix_sync_status!=="synced").length,connections:(data.connections || []).map(c=>({type:c.calendarType,status:c.status,schedule_id:c.scheduleId || "",target_schedule:c.scheduleId===WIX_SCHEDULE_ID,imports:!!c.syncConfig?.listEventFromCalendars?.enabled,exports:!!c.syncConfig?.syncToCalendar?.enabled})),busy_ranges:busy.map(e=>({start:e.start,end:e.end})),checked_at:now.toISOString()});
 }catch(error){return Response.json({success:false,error:error.message==="wix_permission_error"?"wix_permission_error":"wix_check_failed"});}
}
