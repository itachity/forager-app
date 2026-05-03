"use client";

import { Info } from "lucide-react";
import { useT } from "@/lib/forager-i18n-context";

export function DemoBanner({ message }: { message?: string }) {
  const { t } = useT();
  return (
    <div className="rounded-2xl bg-accent-soft text-accent border border-accent/20 px-4 py-2 text-xs font-semibold flex items-center gap-2">
      <Info size={14} />
      {message ?? t("demoBanner.default")}
    </div>
  );
}
