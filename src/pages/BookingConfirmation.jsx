import MeetingAccess from "@/components/booking/MeetingAccess";
import { PRODUCT } from "@/config/product";
import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { getBookingByToken } from "@/api/bookingFunctions";
import { useI18n } from "@/i18n/I18nContext";
import { Loader2, Check, CalendarPlus, Clock } from "lucide-react";

export default function BookingConfirmation() {
  const [params] = useSearchParams();
  const token = params.get("b");
  const { t, setLocale, locale } = useI18n();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) { setError(t("missing_ref")); setLoading(false); return; }
    getBookingByToken({ token })
      .then((res) => { setBooking(res.data.booking); if (res.data.booking.locale) setLocale(res.data.booking.locale); })
      .catch(() => setError(t("not_found")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (loading) return <Center><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></Center>;
  if (error) return <Center><p className="text-sm text-muted-foreground">{error}</p></Center>;

  const gcalLink = buildGoogleCalLink(booking);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <div className="font-mono text-label text-muted-foreground tracking-wider mb-6 text-center">{PRODUCT.mark}</div>
        <div className="rounded-3xl bg-card shadow-soft border border-border/40 p-8 animate-fade-in">
          <div className="w-12 h-12 rounded-full bg-emerald/10 flex items-center justify-center mb-5">
            <Check className="w-6 h-6 text-emerald" />
          </div>
          <h1 className="text-h1 text-foreground font-heading">{t("you_booked")}</h1>
          <p className="text-sm text-muted-foreground mt-2">{locale === "fr" ? "Votre rendez-vous est enregistré. Conservez le lien de cette page pour le retrouver et le gérer." : "Your appointment is saved. Keep this page’s link to find and manage it."}</p>

          <div className="mt-6 border-t border-border/50 pt-5 space-y-3">
            <Row label={t("meeting")} value={booking.booking_type_name} />
            <Row label={t("when")} value={`${booking.dateDisplay} · ${booking.timeDisplay}`} />
            <Row label={t("timezone")} value={booking.tzLabel} />
            <Row label={t("duration")} value={`${booking.duration} min`} />
            {booking.context && <Row label={t("context")} value={booking.context} />}
          </div>

          <div className="mt-6 space-y-2">
            <MeetingAccess key={booking.id} booking={booking} token={token}/>
            <a href={gcalLink} target="_blank" rel="noreferrer"
              className="w-full border border-border/70 text-foreground text-sm py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-secondary/60 transition-colors">
              <CalendarPlus className="w-4 h-4" /> {t("add_to_calendar")}
            </a>
            <Link to={`/m/${booking.reschedule_token}`}
              className="w-full border border-border/70 text-muted-foreground text-sm py-3 rounded-xl flex items-center justify-center gap-2 hover:text-foreground hover:bg-secondary/60 transition-colors">
              <Clock className="w-4 h-4" /> {t("view_booking")}
            </Link>
          </div>
        </div>
        <Link to="/" className="block text-center text-label text-muted-foreground hover:text-foreground mt-6 transition-colors">
          {t("book_another")}
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-label text-muted-foreground mt-0.5">{label}</span>
      <span className="text-sm text-foreground text-right">{value}</span>
    </div>
  );
}

function Center({ children }) {
  return <div className="min-h-screen bg-background flex items-center justify-center">{children}</div>;
}

function buildGoogleCalLink(b) {
  const start = b.start_at.replace(/[-:]/g, "").replace(/\.\d+/, "");
  const end = b.end_at.replace(/[-:]/g, "").replace(/\.\d+/, "");
  const text = encodeURIComponent(`${b.booking_type_name} with ${PRODUCT.name}`);
  const details = encodeURIComponent(b.context ? `${b.context}\n${b.meeting_url || ""}` : (b.meeting_url || ""));
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${end}&details=${details}`;
}
