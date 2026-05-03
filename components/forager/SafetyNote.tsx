import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function SafetyNote({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-2 rounded-2xl bg-muted/60 border border-border/60 p-3 text-xs text-muted-foreground",
        className
      )}
    >
      <Info size={14} className="text-primary mt-0.5 shrink-0" />
      <p className="leading-relaxed">{children}</p>
    </div>
  );
}
