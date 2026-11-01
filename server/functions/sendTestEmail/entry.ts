import { createClientFromRequest } from "../../context.ts";
import { sendTransactionalEmail, EMAIL_CONFIG } from "../../shared/resendClient.ts";
export default async function(req) {
  try {
    const platform = createClientFromRequest(req);
    const user = await platform.auth.me();
    if(user?.role !== "admin") return Response.json({error:"crm_forbidden"},{status:403});
    // Fixed recipient and sender: the browser cannot turn this into a mail relay.
    const result = await sendTransactionalEmail(platform,{
      to:EMAIL_CONFIG.testTo,subject:"Hello World",
      html:"<p>Congrats on sending your <strong>first email</strong>!</p>",
      text:"Congrats on sending your first email!",
      emailType:"test",locale:"en",testMode:true,
      idempotencyKey:"resend-test/opentalk/v1"
    });
    return Response.json(result);
  } catch {
    return Response.json({success:false,status:"failed",error:"email_test_failed"},{status:500});
  }
}
