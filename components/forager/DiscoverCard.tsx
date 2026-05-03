"use client";

import { Star, MapPin, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DiscoverItem = {
  id: string;
  name: string;
  cuisine: string;
  address: string;
  /** Used to compute live distance from the user's geolocation. */
  lat?: number;
  lng?: number;
  imageUrl: string;
  rating: number;
  reasonChip: string;
  tags: string[];
  priceLabel: string;
  /** Distance label (computed at render time when geo is granted). */
  distance?: string;
};

export function DiscoverCard({ item }: { item: DiscoverItem }) {
  const mapsUrl = `https://www.google.com/maps?q=${encodeURIComponent(item.address)}`;
  return (
    <div className="forager-card overflow-hidden flex flex-col">
      <div className="relative aspect-[4/3] bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.imageUrl}
          alt={item.name}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
        <div className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-card/95 px-2 py-1 text-xs font-bold text-accent">
          <Star size={12} fill="currentColor" />
          {item.rating.toFixed(1)}
        </div>
        <div className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-primary/95 text-primary-foreground px-2 py-1 text-[10px] font-semibold uppercase tracking-wider">
          {item.reasonChip}
        </div>
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <h3 className="font-semibold text-sm leading-tight truncate">{item.name}</h3>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.cuisine}</p>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 text-[11px] text-muted-foreground inline-flex items-start gap-1 hover:text-primary transition"
          title={item.address}
        >
          <MapPin size={11} className="mt-0.5 shrink-0" />
          <span className="line-clamp-2">{item.address}</span>
        </a>
        <div className="mt-2 flex flex-wrap gap-1">
          {item.tags.slice(0, 2).map((t) => (
            <span
              key={t}
              className={cn(
                "rounded-full bg-primary-soft text-primary px-2 py-0.5 text-[10px] font-semibold"
              )}
            >
              {t}
            </span>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{item.priceLabel}</span>
          {item.distance && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={11} /> {item.distance}
            </span>
          )}
        </div>
        <Button variant="cta" size="sm" className="mt-3 w-full rounded-xl">
          Let&rsquo;s Eat This! <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
