"use client";

import { useMemo } from "react";
import type { ChatRecommendation } from "@/lib/forager-types";
import { useUserGeo } from "@/lib/forager-geo";

const DEFAULT_CENTER = { lat: 44.5646, lng: -123.262 }; // Corvallis fallback

/**
 * Real Google Maps embed (no API key, no JS lib). Centers on the user's
 * location when geolocation is granted, otherwise falls back to the most
 * relevant restaurant address (or Corvallis).
 */
export function ResultsMap({ recommendations }: { recommendations: ChatRecommendation[] }) {
  const geo = useUserGeo();

  const query = useMemo(() => {
    if (geo) return `${geo.lat},${geo.lng}`;
    const top = recommendations.find((r) => r.address);
    if (top?.address) return encodeURIComponent(top.address);
    return `${DEFAULT_CENTER.lat},${DEFAULT_CENTER.lng}`;
  }, [geo, recommendations]);

  const src = `https://www.google.com/maps?q=${query}&z=14&output=embed`;

  return (
    <div className="relative h-56 w-full rounded-3xl overflow-hidden border border-border/60 forager-card">
      <iframe
        title="Map preview"
        src={src}
        className="absolute inset-0 h-full w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allow="geolocation"
      />
      <div className="absolute bottom-2 right-2 rounded-full bg-card/95 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground border border-border/60 pointer-events-none">
        {geo ? "Centered on you" : "Approximate area"}
      </div>
    </div>
  );
}
