import { ChevronRight } from "lucide-react";

export default function DayStrip({ days, selectedDate, onSelect, onMoreDates }) {
  return (
    <div className="flex w-full min-w-0 max-w-full items-center gap-2 overflow-x-auto overscroll-x-contain scroll-smooth pb-2">
      {days.map((d) => {
        const hasSlots = d.slots.length > 0;
        const isSelected = d.date === selectedDate;
        return (
          <button
            type="button"
            key={d.date}
            aria-pressed={isSelected}
            onClick={() => hasSlots && onSelect(d)}
            disabled={!hasSlots}
            className={`shrink-0 w-[60px] py-2.5 rounded-2xl text-center transition-all duration-200 ${
              isSelected
                ? "bg-primary text-white shadow-soft"
                : hasSlots
                ? "bg-secondary/60 text-foreground hover:bg-secondary hover:-translate-y-0.5"
                : "bg-transparent text-muted-foreground/40 cursor-not-allowed"
            }`}
          >
            <div className={`text-[0.65rem] font-medium uppercase tracking-wide ${isSelected ? "text-white/80" : ""}`}>{d.dayLabel}</div>
            <div className="font-heading text-lg font-semibold leading-none mt-1">{d.dayNumber}</div>
          </button>
        );
      })}
      {onMoreDates && (
        <button
            type="button"
          onClick={onMoreDates}
          className="shrink-0 flex items-center gap-1 px-2 py-2 text-xs text-muted-foreground hover:text-primary transition-colors whitespace-nowrap"
        >
          More <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
