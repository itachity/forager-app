import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function EyebrowLabel({
  children,
  tone = "primary",
  className,
}: {
  children: ReactNode;
  tone?: "primary" | "accent";
  className?: string;
}) {
  return (
    <span className={cn(tone === "accent" ? "eyebrow-accent" : "eyebrow", className)}>
      {children}
    </span>
  );
}
