import { createClientFromRequest } from "../../context.ts";
import { zonedDate } from "../../shared/time.ts";

export default async function(req) {
  try {
    const platform = createClientFromRequest(req);
    const user = await platform.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

    const settings = await platform.asServiceRole.entities.Setting.filter({});
    const refTz = (settings.find(s => s.key === "reference_timezone")?.value) || "UTC";
    const today = zonedDate(new Date().toISOString(), refTz);

    const bookings = await platform.asServiceRole.entities.Booking.filter({ status: "confirmed" });
    const todayBookings = bookings.filter(b => zonedDate(b.start_at, refTz) === today);
    const upcoming = [...bookings].filter(b => new Date(b.start_at) >= new Date()).sort((a, b) => new Date(a.start_at) - new Date(b.start_at)).slice(0, 50);

    const connections = await platform.asServiceRole.entities.CalendarConnection.filter({ active: true });
    const blocks = await platform.asServiceRole.entities.BlockedPeriod.filter({});
    const futureBlocks = blocks.filter(b => new Date(b.end_at) >= new Date());

    return Response.json({
      stats: {
        bookingsToday: todayBookings.length,
        activeCalendars: connections.length,
        blockedHours: futureBlocks.reduce((sum, b) => sum + (new Date(b.end_at) - new Date(b.start_at)) / 3600000, 0),
        upcomingCount: upcoming.length
      },
      upcoming: upcoming.map(b => ({
        id: b.id, start_at: b.start_at, end_at: b.end_at, name: b.name, company: b.company,
        context: b.context, booking_type_name: b.booking_type_name, status: b.status,
        source: b.source, timezone: b.timezone, meeting_url: b.meeting_url, email: b.email
      }))
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
