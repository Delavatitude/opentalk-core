import { Clock, Check } from "lucide-react";
import { useI18n, localizedField } from "@/i18n/I18nContext";

export default function BookingTypeCard({ type, selected, onSelect }) {
  const { locale } = useI18n();
  const name = localizedField(type, "name", locale);
  const description = localizedField(type, "description", locale);
  return (
    <button
      onClick={() => onSelect(type)}
      aria-pressed={selected}
      className={`w-full min-w-0 text-left p-4 sm:p-5 rounded-2xl transition-all duration-200 group ${
        selected
          ? "bg-primary/8 ring-1 ring-primary/40 shadow-soft"
          : "bg-card shadow-soft ring-1 ring-border/40 hover:shadow-soft-lg hover:-translate-y-0.5"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-heading text-base font-semibold text-foreground tracking-tight">{name}</h3>
            {type.brand && (
              <span className="text-[0.65rem] font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{type.brand}</span>
            )}
          </div>
          {description && (
            <p className="text-sm text-muted-foreground mt-1.5 break-words">{description}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 mt-3 text-xs text-muted-foreground">
            <span className="inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 bg-secondary/70 px-2.5 py-1 rounded-full font-medium">
              <Clock className="w-3 h-3" /> {type.duration} min
            </span>
          </div>
        </div>
        {selected && (
          <div className="shrink-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center shadow-soft">
            <Check className="w-3.5 h-3.5" strokeWidth={3} />
          </div>
        )}
      </div>
    </button>
  );
}
