import { useMemo } from "react";
import { Globe } from "lucide-react";
import { timezoneChoices, utcOffset } from "@/lib/visitorTimezone";
export default function TimezonePicker({ value, onChange, locale, disabled, referenceDate }) {
  const choices = useMemo(() => timezoneChoices(value), [value]);
  const fr = locale === "fr";
  return <div className="inline-flex max-w-full items-center gap-1.5 text-muted-foreground">
    <Globe className="w-3.5 h-3.5 shrink-0" aria-hidden="true"/><label htmlFor="booking-timezone" className="sr-only">{fr ? "Votre fuseau horaire" : "Your timezone"}</label>
    <select id="booking-timezone" value={value} onChange={event => onChange(event.target.value)} disabled={disabled} className="min-h-11 max-w-[min(18rem,75vw)] min-w-0 cursor-pointer rounded-md border-0 bg-transparent py-2 pl-1 pr-6 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50">
      {choices.map(zone => <option key={zone} value={zone}>{zone.replace(/_/g," ")} · {utcOffset(zone, referenceDate)}</option>)}
    </select>
  </div>;
}
