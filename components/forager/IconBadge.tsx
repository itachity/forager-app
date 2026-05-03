import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  tone?: "forest" | "orange";
  size?: "md" | "lg";
  className?: string;
};

export function IconBadge({ children, tone = "forest", size = "lg", className }: Props) {
  const dim = size === "lg" ? "h-14 w-14" : "h-10 w-10";
  const bg = tone === "orange" ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground";
  return (
    <div className={cn("flex items-center justify-center rounded-2xl", dim, bg, className)}>
      {children}
    </div>
  );
}
