import { createClientFromRequest } from "../../context.ts";

export default async function(req) {
  try {
    const platform = createClientFromRequest(req);
    const user = await platform.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

    const { accessToken } = await platform.asServiceRole.connectors.getConnection("googlecalendar");
    const res = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) return Response.json({ error: "Failed to fetch calendars" }, { status: 502 });
    const data = await res.json();
    const calendars = (data.items || []).map(c => ({
      id: c.id,
      summary: c.summary || c.id,
      primary: !!c.primary,
      accessRole: c.accessRole,
      backgroundColor: c.backgroundColor
    }));
    return Response.json({ calendars });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
