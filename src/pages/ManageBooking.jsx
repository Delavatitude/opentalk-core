import MeetingAccess from "@/components/booking/MeetingAccess";
import { PRODUCT } from "@/config/product";
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getBookingByToken } from "@/api/bookingFunctions";
import { cancelBooking } from "@/api/bookingFunctions";
import { rescheduleBooking } from "@/api/bookingFunctions";
import { getAvailability } from "@/api/bookingFunctions";
import DayStrip from "@/components/booking/DayStrip";
import SlotGrid from "@/components/booking/SlotGrid";
import { useI18n } from "@/i18n/I18nContext";
import { Loader2, Check, X, Clock, ArrowLeft } from "lucide-react";

export default function ManageBooking() {
  const { token } = useParams();
  const { t, setLocale } = useI18n();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState(null);
  const [availability, setAvailability] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [cancelled, setCancelled] = useState(false);
  const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");

  const load = () => {
    setLoading(true);
    getBookingByToken({ token })
      .then((res) => {
        setBooking(res.data.booking);
        setCancelled(res.data.booking.status === "cancelled");
        if (res.data.booking.locale) setLocale(res.data.booking.locale);
      })
      .catch(() => setError(t("not_found")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  };

  useEffect(() => { load(); }, [token]);

  const startReschedule = async () => {
    setMode("reschedule");
    setError(null);
    const res = await getAvailability({ booking_type_id: booking.booking_type_id, timezone, days: 14, locale: booking.locale || "en" });
    setAvailability(res.data);
    const first = res.data.days.find((d) => d.slots.length > 0);
    setSelectedDate(first ? first.date : res.data.days[0]?.date || null);
    setSelectedSlot(null);
  };

  const confirmReschedule = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await rescheduleBooking({ token, new_start_at: selectedSlot.start_at, new_end_at: selectedSlot.end_at });
      setBooking((b) => ({ ...b, start_at: res.data.booking.start_at, end_at: res.data.booking.end_at, dateDisplay: res.data.booking.dateDisplay, timeDisplay: res.data.booking.timeDisplay, tzLabel: res.data.booking.tzLabel }));
      setMode(null);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  const doCancel = async () => {
    if (!confirm(t("cancel_confirm"))) return;
    setBusy(true);
    try {
      await cancelBooking({ token });
      setCancelled(true);
      setMode(null);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Center><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></Center>;
  if (error && !booking) return <Center><p className="text-sm text-muted-foreground">{error}</p></Center>;

  const currentDay = availability?.days.find((d) => d.date === selectedDate);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <div className="font-mono text-label text-muted-foreground tracking-wider mb-6 text-center">{PRODUCT.mark}</div>
        <div className="rounded-3xl bg-card shadow-soft border border-border/40 p-8 animate-fade-in">
          {cancelled ? (
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-coral/10 flex items-center justify-center mx-auto mb-5">
                <X className="w-6 h-6 text-coral" />
              </div>
              <h1 className="text-h1 text-foreground font-heading">{t("cancelled_title")}</h1>
              <p className="text-sm text-muted-foreground mt-2">{t("slot_released")}</p>
              <Link to="/" className="inline-block mt-6 text-label text-foreground hover:underline">{t("book_new")}</Link>
            </div>
          ) : mode === "reschedule" ? (
            <div>
              <button onClick={() => setMode(null)} className="flex items-center gap-1 text-label text-muted-foreground hover:text-foreground mb-4 transition-colors">
                <ArrowLeft className="w-3 h-3" /> {t("back")}
              </button>
              <h1 className="text-h1 text-foreground font-heading mb-5">{t("reschedule")}</h1>
              <div className="text-label text-muted-foreground mb-3">{t("pick_new_time")}</div>
              <DayStrip days={availability?.days || []} selectedDate={selectedDate} onSelect={(d) => { setSelectedDate(d.date); setSelectedSlot(null); }} />
              <div className="mt-5">
                <SlotGrid slots={currentDay?.slots || []} selectedSlot={selectedSlot} onSelect={setSelectedSlot} />
              </div>
              {error && <p className="text-sm text-coral mt-3">{error}</p>}
              {selectedSlot && (
                <button onClick={confirmReschedule} disabled={busy}
                  className="w-full mt-5 bg-primary text-white font-semibold text-sm py-3.5 rounded-xl disabled:opacity-40 flex items-center justify-center gap-2 shadow-soft">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : t("confirm_new_time")}
                </button>
              )}
            </div>
          ) : (
            <div>
              <div className="w-12 h-12 rounded-full bg-emerald/10 flex items-center justify-center mb-5">
                <Check className="w-6 h-6 text-emerald" />
              </div>
              <h1 className="text-h1 text-foreground font-heading">{t("your_booking")}</h1>
              <div className="mt-5 border-t border-border/50 pt-5 space-y-3">
                <Row label={t("meeting")} value={booking.booking_type_name} />
                <Row label={t("when")} value={`${booking.dateDisplay} · ${booking.timeDisplay}`} />
                <Row label={t("timezone")} value={booking.tzLabel} />
                {booking.context && <Row label={t("context")} value={booking.context} />}
              </div>
              <MeetingAccess key={booking.id} booking={booking} token={token}/>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <button onClick={startReschedule} className="border border-border/70 text-foreground text-sm py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-secondary/60 transition-colors">
                  <Clock className="w-4 h-4" /> {t("reschedule")}
                </button>
                <button onClick={doCancel} disabled={busy} className="border border-coral/40 text-coral text-sm py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-coral/10 transition-colors disabled:opacity-40">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><X className="w-4 h-4" /> {t("cancel")}</>}
                </button>
              </div>
              {error && <p className="text-sm text-coral mt-3">{error}</p>}
            </div>
          )}
        </div>
        <Link to="/" className="block text-center text-label text-muted-foreground hover:text-foreground mt-6 transition-colors">{PRODUCT.name}</Link>
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
