import { cn } from "@/lib/utils";

export type ConfidenceLevel = "high" | "medium" | "medium-low" | "low";

export function ConfidenceBadge({
  level,
  prefix,
  className,
}: {
  level: ConfidenceLevel;
  /** Optional prefix like "Macros" or "Match" (rendered "Macros · high"). */
  prefix?: string;
  className?: string;
}) {
  const tone =
    level === "high"
      ? "bg-primary-soft text-primary"
      : level === "low"
        ? "bg-destructive/10 text-destructive"
        : "bg-accent-soft text-accent";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wider",
        tone,
        className
      )}
    >
      {prefix && <span className="text-[10px] font-medium opacity-70">{prefix} ·</span>}
      {level}
    </span>
  );
}
