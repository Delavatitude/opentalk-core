import { useState } from "react";
import { adminBookingActions } from "@/api/bookingFunctions";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useI18n } from "@/i18n/I18nContext";
import CallLogSection from "./CallLogSection";

const input = "w-full min-w-0 min-h-11 rounded-xl border bg-background p-3";

export default function AdminBookingDialog({ booking, onClose, onChanged }) {
  const { t, locale } = useI18n();
  const timezone = booking.timezone || "UTC";
  const [currentBooking, setCurrentBooking] = useState(booking);
  const callHappened = Date.parse(currentBooking.start_at) <= Date.now() || ["completed", "missed", "no_show"].includes(currentBooking.call_outcome);
  const [tab, setTab] = useState(callHappened ? "follow-up" : "reschedule");
  const [callBusy, setCallBusy] = useState(false);
  const [action, setAction] = useState(booking.status === "cancelled" || callHappened ? "delete" : "move");
  const [newDateTime, setNewDateTime] = useState(() => toZonedInput(booking.start_at, timezone));
  const [email, setEmail] = useState(booking.notify_email !== false);
  const [sms, setSms] = useState(false);
  const [sync, setSync] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const newStart = action === "move" ? zonedLocalToDate(newDateTime, timezone) : null;
      if (action === "move" && (!newStart || Number.isNaN(newStart.getTime()))) {
        setError("admin_booking_datetime");
        return;
      }
      const response = await adminBookingActions({
        action,
        booking_id: booking.id,
        expected_start_at: booking.start_at,
        new_start_at: newStart?.toISOString(),
        notify_email: email,
        notify_sms: sms,
        sync_calendars: sync,
      });
      if (!response.data.ok) {
        setError(response.data.error || "crm_error");
        await onChanged("");
        return;
      }
      await onChanged(response.data.warning || (response.data.deleted ? "admin_booking_deleted" : "admin_booking_done"));
      onClose();
    } catch (requestError) {
      setError(requestError.response?.data?.error || "crm_error");
    } finally {
      setBusy(false);
    }
  }

  const currentTime = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(booking.start_at));

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="admin-booking-title" className="fixed inset-0 z-50 overflow-y-auto bg-background/90 p-4 sm:p-8">
      <div className="max-w-xl mx-auto min-w-0 bg-card rounded-2xl border p-5 space-y-5">
        <div className="flex justify-between gap-3">
          <h2 id="admin-booking-title" className="font-heading text-xl">{t("admin_booking_manage")}</h2>
          <button type="button" className="min-h-11 px-3 rounded-xl" disabled={busy || callBusy} onClick={onClose}>{t("crm_close")}</button>
        </div>

        <div className="rounded-xl border bg-background p-4 break-words">
          <p className="font-medium">{booking.name}</p>
          <p className="text-sm break-all">{booking.email}</p>
          <p className="text-sm mt-2">{booking.booking_type_name} · {currentTime}</p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full h-auto grid grid-cols-2 p-1">
            <TabsTrigger value="reschedule" disabled={busy || callBusy} className="min-h-11">{t("admin_booking_reschedule_tab")}</TabsTrigger>
            <TabsTrigger value="follow-up" disabled={busy || callBusy} className="min-h-11">{t("admin_call_section")}</TabsTrigger>
          </TabsList>
          <TabsContent value="reschedule" forceMount className="data-[state=inactive]:hidden">
        <form onSubmit={submit} className="space-y-4">
          <fieldset disabled={busy} className="min-w-0 space-y-4">
            <div className="flex flex-wrap gap-2">
              {(currentBooking.status === "cancelled" || callHappened ? ["delete"] : ["move", "delete"]).map((item) => (
                <button key={item} type="button" aria-pressed={action === item} onClick={() => { setAction(item); setError(""); }} className={"min-h-11 rounded-xl px-4 py-2 border " + (action === item ? "bg-secondary font-medium" : "")}>
                  {t("admin_booking_" + item)}
                </button>
              ))}
            </div>

            {action === "move" ? (
              <div className="space-y-4">
                <label className="block text-sm font-medium">
                  {t("admin_booking_new_datetime")}
                  <input type="datetime-local" required className={input + " mt-1.5"} value={newDateTime} onChange={(event) => setNewDateTime(event.target.value)} />
                </label>
                <p className="text-sm text-muted-foreground">{t("admin_booking_any_time_help", { timezone })}</p>

                <label className="min-h-11 flex gap-3 items-center">
                  <input type="checkbox" checked={sync} onChange={(event) => setSync(event.target.checked)} />
                  {t("admin_booking_sync")}
                </label>
                {!sync && <p className="text-sm text-amber-800">{t("admin_booking_sync_help")}</p>}
              </div>
            ) : (
              <p className="text-sm">{t("admin_booking_delete_help")}</p>
            )}

            <div className="rounded-xl border p-4 space-y-3">
              <p className="text-sm font-medium">{t("admin_booking_options")}</p>
              <label className="min-h-11 flex gap-3 items-center">
                <input type="checkbox" checked={email} onChange={(event) => setEmail(event.target.checked)} />
                {t("booking_notify_email")}
              </label>
              <label className="min-h-11 flex gap-3 items-center">
                <input type="checkbox" checked={sms} onChange={(event) => setSms(event.target.checked)} />
                {t("booking_notify_sms")}
              </label>
              {sms && <p className="text-sm text-muted-foreground">{t("booking_sms_pending")}</p>}
            </div>

            <button disabled={busy || (action === "move" && !newDateTime)} className={"min-h-11 rounded-xl px-4 py-3 text-white disabled:opacity-40 " + (action === "delete" ? "bg-destructive" : "bg-primary")}>
              {t(busy ? "crm_saving" : action === "delete" ? "admin_booking_delete" : "confirm_new_time")}
            </button>
          </fieldset>
        </form>
        {error && <p role="alert" className="text-sm text-destructive mt-4">{t(error)}</p>}
          </TabsContent>
          <TabsContent value="follow-up" forceMount className="data-[state=inactive]:hidden">
        <CallLogSection booking={currentBooking} onBusyChange={setCallBusy} onChanged={async (message, updated) => {
          if (updated) {
            setCurrentBooking((prev) => ({ ...prev, ...updated }));
            if (["completed", "missed", "no_show"].includes(updated.call_outcome)) setAction("delete");
          }
          await onChanged(message);
        }} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function toZonedInput(iso, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${String(Number(values.hour) % 24).padStart(2, "0")}:${values.minute}`;
}

function zonedLocalToDate(localValue, timezone) {
  if (!localValue) return null;
  const [datePart, timePart] = localValue.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(guess);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const represented = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour) % 24, Number(values.minute), Number(values.second));
  return new Date(guess.getTime() - (represented - guess.getTime()));
}
