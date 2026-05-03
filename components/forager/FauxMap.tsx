"use client";

import { MapPin } from "lucide-react";
import type { ChatRecommendation } from "@/lib/forager-types";

/**
 * A no-library faux map. Renders a soft gridded background and pins each
 * recommendation at a deterministic position derived from its `place` name.
 */
export function FauxMap({ recommendations }: { recommendations: ChatRecommendation[] }) {
  return (
    <div className="relative h-44 w-full rounded-3xl overflow-hidden border border-border/60 bg-primary-soft/40 forager-card">
      {/* gridded background */}
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "linear-gradient(to right, hsl(96 22% 70% / 0.2) 1px, transparent 1px), linear-gradient(to bottom, hsl(96 22% 70% / 0.2) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      {/* gentle "river" curve */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 320 176"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          d="M-10 130 Q 80 90, 160 110 T 340 80"
          stroke="hsl(96 25% 30% / 0.18)"
          strokeWidth={6}
          fill="none"
        />
      </svg>
      {/* pins */}
      {recommendations.slice(0, 5).map((r, idx) => {
        const seed = stringHash(r.place);
        const left = 12 + (seed % 76); // 12..88 percent
        const top = 18 + ((seed >> 4) % 56); // 18..74 percent
        const isTop = idx === 0;
        return (
          <div
            key={r.place + idx}
            className="absolute -translate-x-1/2 -translate-y-full"
            style={{ left: `${left}%`, top: `${top}%` }}
            title={r.place}
          >
            <MapPin
              size={isTop ? 28 : 22}
              className={isTop ? "text-accent" : "text-primary"}
              fill={isTop ? "var(--accent)" : "var(--primary)"}
              fillOpacity={0.2}
            />
          </div>
        );
      })}
      <div className="absolute bottom-2 right-2 rounded-full bg-card/90 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground border border-border/60">
        Map preview
      </div>
    </div>
  );
}

function stringHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
