"use client";

import { useEffect, useMemo, useState } from "react";
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map,
  Pin,
  useMap,
} from "@vis.gl/react-google-maps";
import { ExternalLink } from "lucide-react";
import type { ChatRecommendation } from "@/lib/forager-types";
import { useUserGeo } from "@/lib/forager-geo";

const DEFAULT_CENTER = { lat: 44.5646, lng: -123.262 }; // Corvallis fallback
const MAP_ID = "forager-results-map";
const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

type Pinnable = {
  rec: ChatRecommendation;
  lat: number;
  lng: number;
};

function pinnable(recommendations: ChatRecommendation[]): Pinnable[] {
  return recommendations
    .slice(0, 3)
    .filter(
      (r): r is ChatRecommendation & { lat: number; lng: number } =>
        typeof r.lat === "number" && typeof r.lng === "number"
    )
    .map((r) => ({ rec: r, lat: r.lat, lng: r.lng }));
}

function FitBounds({
  pins,
  userGeo,
}: {
  pins: Pinnable[];
  userGeo: { lat: number; lng: number } | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || pins.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    for (const p of pins) bounds.extend({ lat: p.lat, lng: p.lng });
    if (userGeo) bounds.extend(userGeo);
    map.fitBounds(bounds, 64);
  }, [map, pins, userGeo]);

  return null;
}

function IframeFallback({ recommendations }: { recommendations: ChatRecommendation[] }) {
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

export function ResultsMap({ recommendations }: { recommendations: ChatRecommendation[] }) {
  const geo = useUserGeo();
  const pins = useMemo(() => pinnable(recommendations), [recommendations]);
  const [openRank, setOpenRank] = useState<number | null>(null);

  // Without an API key or pinnable lat/lngs we can't render real pins —
  // fall back to the iframe so the page never breaks.
  if (!MAPS_API_KEY || pins.length === 0) {
    return <IframeFallback recommendations={recommendations} />;
  }

  const center = pins[0] ? { lat: pins[0].lat, lng: pins[0].lng } : geo ?? DEFAULT_CENTER;

  return (
    <div className="relative h-56 w-full rounded-3xl overflow-hidden border border-border/60 forager-card">
      <APIProvider apiKey={MAPS_API_KEY}>
        <Map
          mapId={MAP_ID}
          defaultCenter={center}
          defaultZoom={13}
          gestureHandling="greedy"
          disableDefaultUI
          zoomControl
          className="h-full w-full"
        >
          <FitBounds pins={pins} userGeo={geo} />
          {pins.map(({ rec, lat, lng }) => (
            <AdvancedMarker
              key={`${rec.place}-${rec.rank}`}
              position={{ lat, lng }}
              onClick={() => setOpenRank(rec.rank)}
            >
              <Pin
                background="#dc2626"
                borderColor="#7f1d1d"
                glyphColor="#ffffff"
                glyph={String(rec.rank)}
              />
              {openRank === rec.rank && (
                <InfoWindow
                  position={{ lat, lng }}
                  onCloseClick={() => setOpenRank(null)}
                >
                  <div className="text-xs">
                    <div className="font-semibold text-sm mb-0.5">{rec.place}</div>
                    {rec.address && (
                      <div className="text-muted-foreground mb-1">{rec.address}</div>
                    )}
                    {rec.google_maps_url && (
                      <a
                        href={rec.google_maps_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 font-semibold text-primary hover:underline"
                      >
                        Directions <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                </InfoWindow>
              )}
            </AdvancedMarker>
          ))}
        </Map>
      </APIProvider>
      <div className="absolute bottom-2 right-2 rounded-full bg-card/95 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground border border-border/60 pointer-events-none">
        Top {pins.length} pinned
      </div>
    </div>
  );
}
