import { createClientFromRequest } from "../../context.ts";
import {linkUsable,publicLink} from "../../shared/bookingLinks.ts";
export default async function(req) {
  try {
    const {slug}=await req.json();
    if(typeof slug!=="string" || !slug || slug.length>200) return Response.json({error:"not_found"},{status:404});
    const db=createClientFromRequest(req).asServiceRole.entities;
    const link=(await db.BookingLink.filter({slug,active:true},null,1))[0];
    if(!linkUsable(link)) return Response.json({error:"not_found"},{status:404});
    return Response.json({link:publicLink(link)});
  } catch {return Response.json({error:"not_found"},{status:404});}
}
