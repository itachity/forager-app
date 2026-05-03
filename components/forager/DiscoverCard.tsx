"use client";

import { Star, MapPin, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DiscoverItem = {
  id: string;
  name: string;
  cuisine: string;
  imageUrl: string;
  rating: number;
  reasonChip: string;
  tags: string[];
  priceLabel: string;
  distance: string;
};

export function DiscoverCard({ item }: { item: DiscoverItem }) {
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
        <p className="text-xs text-muted-foreground mt-0.5">{item.cuisine}</p>
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
          <span className="inline-flex items-center gap-1">
            <MapPin size={11} /> {item.distance}
          </span>
        </div>
        <Button variant="cta" size="sm" className="mt-3 w-full rounded-xl">
          Let&rsquo;s Eat This! <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
