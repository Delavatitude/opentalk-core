import {env} from "../../env.ts";
import {createClientFromRequest} from "../../context.ts";

export default async function(req) {
  try {
    const client=createClientFromRequest(req);
    const user=await client.auth.me();
    if(user?.role!=="admin")return Response.json({error:"forbidden"},{status:403});
    const settings=await client.asServiceRole.entities.Setting.filter({key:"app_base_url"});
    const keyConfigured=!!env("RESEND_API_KEY")?.trim();
    const sender=env("RESEND_FROM")?.trim() || "";
    const senderConfigured=/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(sender) || /<[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>/.test(sender);
    let publicUrlConfigured=false;
    try {const url=new URL(settings[0]?.value || "");publicUrlConfigured=url.protocol==="https:" && !url.username && !url.password;}catch{}
    let googleAuthorized=false;
    try {const connection=await client.asServiceRole.connectors.getConnection("googlecalendar");googleAuthorized=!!connection?.accessToken;}catch{}
    return Response.json({
      google:{authorized:googleAuthorized},
      resend:{configured:keyConfigured && senderConfigured && publicUrlConfigured,key_configured:keyConfigured,sender_configured:senderConfigured,public_url_configured:publicUrlConfigured,domain_verified:null}
    },{headers:{"Cache-Control":"no-store"}});
  }catch{return Response.json({error:"integration_status_unavailable"},{status:503});}
}
