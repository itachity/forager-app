"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export function ScanEntryCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="forager-card flex items-start gap-3 p-4 transition hover:border-primary/40 hover:bg-primary-soft/30"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-sm leading-snug">{title}</div>
        <div className="text-xs text-muted-foreground mt-1 leading-snug">
          {description}
        </div>
      </div>
      <ChevronRight size={18} className="text-muted-foreground mt-1 shrink-0" />
    </Link>
  );
}
