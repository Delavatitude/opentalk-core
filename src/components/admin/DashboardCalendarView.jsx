import { Link } from "react-router-dom";

const DAY_MS = 86400000;

export default function DashboardCalendarView({ bookings, timezone, locale, t }) {
  const language = locale === "fr" ? "fr-FR" : "en-GB";
  const today = dateKey(new Date(), timezone);
  const days = Array.from({ length: 31 }, (_, index) => addDays(today, index));
  const end = addDays(today, 31);
  const activeBookings = bookings
    .filter((booking) => ["confirmed", "rescheduled"].includes(booking.status))
    .filter((booking) => {
      const key = dateKey(new Date(booking.start_at), timezone);
      return key >= today && key < end;
    })
    .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
  const byDay = new Map(days.map((day) => [day, []]));

  for (const booking of activeBookings) {
    const key = dateKey(new Date(booking.start_at), timezone);
    if (byDay.has(key)) byDay.get(key).push(booking);
  }

  const firstWeekday = mondayIndex(days[0]);
  const weekdayLabels = Array.from({ length: 7 }, (_, index) => {
    const monday = new Date("2026-09-14T12:00:00Z");
    monday.setUTCDate(monday.getUTCDate() + index);
    return new Intl.DateTimeFormat(language, { weekday: "short", timeZone: "UTC" }).format(monday);
  });

  const formatDay = (day, options) => new Intl.DateTimeFormat(language, {
    ...options,
    timeZone: "UTC",
  }).format(new Date(day + "T12:00:00Z"));

  const formatTime = (iso) => new Intl.DateTimeFormat(language, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(iso));

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl">{t("dashboard_calendar_title")}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t("dashboard_calendar_help", { timezone })}</p>
        </div>
        <span className="text-sm text-muted-foreground">{activeBookings.length} {t("booking_results")}</span>
      </div>

      <div className="hidden md:block overflow-hidden rounded-2xl border bg-card">
        <div className="grid grid-cols-7 border-b bg-secondary/40">
          {weekdayLabels.map((label) => (
            <div key={label} className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: firstWeekday }, (_, index) => (
            <div key={"empty-" + index} aria-hidden="true" className="min-h-28 border-b border-r bg-secondary/10" />
          ))}
          {days.map((day, index) => {
            const dayBookings = byDay.get(day);
            const isToday = day === today;
            return (
              <div key={day} className={"min-h-28 p-2 border-b border-r " + (isToday ? "bg-primary/5" : "")}>
                <div className="flex items-center justify-between mb-2">
                  <span className={"inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-sm " + (isToday ? "bg-primary text-white font-semibold" : "text-foreground")}>
                    {formatDay(day, { day: "numeric" })}
                  </span>
                  {(index === 0 || day.endsWith("-01")) && <span className="text-[11px] uppercase text-muted-foreground">{formatDay(day, { month: "short" })}</span>}
                </div>
                <div className="space-y-1">
                  {dayBookings.map((booking) => (
                    <Link
                      key={booking.id}
                      to={"/admin/bookings?booking=" + encodeURIComponent(booking.id)}
                      className="block rounded-lg bg-secondary px-2 py-1.5 text-xs hover:bg-primary hover:text-white transition-colors"
                      title={booking.name + " · " + booking.booking_type_name}
                    >
                      <span className="font-semibold">{formatTime(booking.start_at)}</span>
                      <span className="block truncate mt-0.5">{booking.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="md:hidden space-y-3">
        {days.filter((day) => byDay.get(day).length).map((day) => (
          <div key={day} className="rounded-2xl border bg-card p-4">
            <h3 className="font-medium capitalize">{formatDay(day, { weekday: "long", day: "numeric", month: "long" })}</h3>
            <div className="mt-3 space-y-2">
              {byDay.get(day).map((booking) => (
                <Link key={booking.id} to={"/admin/bookings?booking=" + encodeURIComponent(booking.id)} className="min-h-11 flex items-center justify-between gap-3 rounded-xl bg-secondary px-3 py-2 hover:bg-primary hover:text-white transition-colors">
                  <span className="font-semibold text-sm">{formatTime(booking.start_at)}</span>
                  <span className="min-w-0 flex-1 text-right">
                    <span className="block text-sm font-medium truncate">{booking.name}</span>
                    <span className="block text-xs opacity-75 truncate">{booking.booking_type_name}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
        {!activeBookings.length && <p className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">{t("dashboard_calendar_empty")}</p>}
      </div>
    </section>
  );
}

function dateKey(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(dateString, amount) {
  const date = new Date(dateString + "T12:00:00Z");
  return new Date(date.getTime() + amount * DAY_MS).toISOString().slice(0, 10);
}

function mondayIndex(dateString) {
  return (new Date(dateString + "T12:00:00Z").getUTCDay() + 6) % 7;
}
