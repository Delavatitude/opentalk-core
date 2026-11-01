import {createClientFromRequest} from "../../context.ts";
import {findPage,pageTypes,cleanPage} from "../../shared/bookingPages.ts";
export default async function(req){try{
 const b=await req.json(),client=createClientFromRequest(req),db=client.asServiceRole.entities;
 let page;
 if(b.preview_id){if((await client.auth.me())?.role!=="admin")return Response.json({error:"crm_forbidden"},{status:403});const row=await db.BookingPage.get(b.preview_id);page={...cleanPage(row),id:row.id};}
 else page=await findPage(db,{id:b.id,slug:b.slug || "/"});
 if(!page)return Response.json({error:"pages_unavailable"},{status:404});
 const types=pageTypes(page,await db.BookingType.filter({active:true}));
 // Only the public configuration is returned; draft snapshot and internal name stay private.
 const {internal_name,...publicPage}=page;
 return Response.json({page:publicPage,types},{headers:{"Cache-Control":"no-store"}});
 }catch{return Response.json({error:"pages_unavailable"},{status:404});}}
