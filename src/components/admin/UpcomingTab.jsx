import { useEffect, useState } from "react";
import { adminStats } from "@/api/bookingFunctions";
import { useI18n } from "@/i18n/I18nContext";
import { Loader2, Video, MapPin, ExternalLink } from "lucide-react";

export default function UpcomingTab() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    adminStats({}).then((res) => setData(res.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (!data) return null;

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <Stat label={t("stat_today")} value={data.stats.bookingsToday} />
        <Stat label={t("stat_active_calendars")} value={data.stats.activeCalendars} />
        <Stat label={t("stat_blocked_hrs")} value={Math.round(data.stats.blockedHours)} />
        <Stat label={t("stat_upcoming")} value={data.stats.upcomingCount} />
      </div>

      <div className="text-label text-muted-foreground mb-3">{t("upcoming_meetings")}</div>
      {data.upcoming.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center border border-border/60 rounded-2xl">{t("no_upcoming")}</p>
      ) : (
        <div className="border border-border divide-y divide-border">
          {data.upcoming.map((b) => (
            <div key={b.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center text-sm">
              <div className="col-span-3 sm:col-span-2 font-mono text-xs text-foreground">
                {new Date(b.start_at).toUTCString().slice(5, 22)}
              </div>
              <div className="col-span-4 sm:col-span-3 text-foreground">{b.name}</div>
              <div className="col-span-3 sm:col-span-2 text-mutedtext hidden sm:block">{b.company || "—"}</div>
              <div className="col-span-3 sm:col-span-2 text-muted-foreground text-xs">{b.context || b.booking_type_name}</div>
              <div className="col-span-2 sm:col-span-2 flex items-center justify-end gap-2">
                {b.meeting_url && (
                  <a href={b.meeting_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                    {b.location_type === "google_meet" || !b.location_type ? <Video className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                  </a>
                )}
                <a href={`mailto:${b.email}`} className="text-mutedtext hover:text-foreground hidden sm:block">
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="border border-border bg-card p-4">
      <div className="text-label text-mutedtext">{label}</div>
      <div className="font-heading text-2xl font-bold text-foreground mt-1">{value}</div>
    </div>
  );
}
