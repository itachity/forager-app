"use client";

import { ArrowLeft } from "lucide-react";
import { ForagerLogo } from "./ForagerLogo";

export function ProgressHeader({
  step,
  total,
  onBack,
}: {
  step: number;
  total: number;
  onBack?: () => void;
}) {
  const progress = Math.max(0, Math.min(100, (step / total) * 100));
  return (
    <div className="px-5 pt-4 pb-3 sticky top-0 z-10 bg-background/95 backdrop-blur">
      <div className="flex items-center justify-between mb-2.5">
        {onBack ? (
          <button
            onClick={onBack}
            type="button"
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground hover:bg-muted transition"
          >
            <ArrowLeft size={18} />
          </button>
        ) : (
          <div className="w-9" />
        )}
        <ForagerLogo size="sm" />
        <span className="text-xs text-muted-foreground font-medium">
          {step}/{total}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-500 rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
