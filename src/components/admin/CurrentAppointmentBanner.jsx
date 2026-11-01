import { Link } from "react-router-dom";
import { ArrowRight, Video } from "lucide-react";

export default function CurrentAppointmentBanner({ booking, timezone, locale, t }) {
  const language = locale === "fr" ? "fr-FR" : "en-GB";
  const format = (value) => new Intl.DateTimeFormat(language, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));
  const meetingUrl = /^https:\/\//.test(booking.meeting_url || "") ? booking.meeting_url : "";

  return (
    <section aria-labelledby="current-appointment-title" className="rounded-2xl border-2 border-primary bg-primary/5 p-4 sm:p-5 shadow-soft">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="relative mt-1 flex h-3 w-3 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-50 motion-reduce:animate-none" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
          </span>
          <div className="min-w-0">
            <p id="current-appointment-title" className="text-xs font-semibold uppercase tracking-wide text-primary">{t("current_appointment")}</p>
            <h2 className="mt-1 font-heading text-xl break-words">{booking.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground break-words">
              {booking.booking_type_name} · {format(booking.start_at)}–{format(booking.end_at)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {meetingUrl && (
            <a href={meetingUrl} target="_blank" rel="noopener noreferrer" className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:opacity-90 transition-opacity">
              <Video className="h-4 w-4" aria-hidden="true" />
              {t("join_meeting")}
            </a>
          )}
          <Link to={"/admin/bookings?booking=" + encodeURIComponent(booking.id)} className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl border bg-card px-4 text-sm font-medium hover:bg-secondary/60 transition-colors">
            {t("booking_shortcut")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
