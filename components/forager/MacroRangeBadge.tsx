import { cn } from "@/lib/utils";

type Range = { min?: number; max?: number };

export function MacroRangeBadge({
  label,
  range,
  unit,
  text,
  className,
}: {
  label: string;
  /** Numeric min/max range. */
  range?: Range;
  unit?: string;
  /** Pre-formatted text from the chat endpoint, e.g. "800-1000 kcal". */
  text?: string;
  className?: string;
}) {
  const display =
    text && text.length > 0
      ? text
      : range && (range.min || range.max)
        ? `${Math.round(range.min ?? 0)}–${Math.round(range.max ?? range.min ?? 0)}`
        : "—";
  return (
    <div className={cn("rounded-2xl bg-primary-soft/60 p-3 text-center", className)}>
      <div className="text-[11px] uppercase tracking-wider text-primary font-semibold">
        {label}
      </div>
      <div className="font-semibold mt-1">
        {display}
        {unit && display !== "—" && !text && (
          <span className="text-xs text-muted-foreground ml-1">{unit}</span>
        )}
      </div>
    </div>
  );
}
