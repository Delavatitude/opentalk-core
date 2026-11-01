export default function SlotGrid({ slots, selectedSlot, onSelect }) {
  if (!slots || slots.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-muted-foreground">No times available this day.</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Try another date.</p>
      </div>
    );
  }
  return (
    <div className="grid w-full min-w-0 grid-cols-2 sm:grid-cols-3 gap-2">
      {slots.map((s) => {
        const isSelected = selectedSlot && selectedSlot.start_at === s.start_at;
        return (
          <button
            type="button"
            key={s.start_at}
            aria-pressed={Boolean(isSelected)}
            aria-label={s.offset ? `${s.label} ${s.offset}` : s.label}
            title={s.offset ? `${s.label} ${s.offset}` : undefined}
            onClick={() => onSelect(s)}
            className={`min-w-0 min-h-11 px-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
              isSelected
                ? "bg-primary text-white shadow-soft"
                : "bg-secondary/60 text-foreground hover:bg-secondary hover:-translate-y-0.5"
            }`}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
