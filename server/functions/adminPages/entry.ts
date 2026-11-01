import {createClientFromRequest} from "../../context.ts";
import {adminPagesAction} from "../../shared/bookingPages.ts";
export default async function(req){try{const platform=createClientFromRequest(req);if((await platform.auth.me())?.role!=="admin")return Response.json({error:"crm_forbidden"},{status:403});return Response.json(await adminPagesAction(platform.asServiceRole.entities,await req.json()));}catch(e){return Response.json({error:String(e.message).startsWith("pages_")?e.message:"pages_error"},{status:400});}}
