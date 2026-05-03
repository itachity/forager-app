"use client";

import { ExternalLink } from "lucide-react";
import type { ChatRecommendation, UserProfile } from "@/lib/forager-types";
import { MacroRangeBadge } from "./MacroRangeBadge";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { AllergenFlag, intersectAllergens } from "./AllergenFlag";
import { cn } from "@/lib/utils";

export function RecommendationCard({
  rec,
  isTopPick = false,
  profile,
}: {
  rec: ChatRecommendation;
  isTopPick?: boolean;
  profile: UserProfile;
}) {
  const flags = intersectAllergens(profile.dietary.allergens, [rec.order]);

  return (
    <div
      className={cn(
        "forager-card p-5",
        isTopPick && "border-accent border-2 shadow-[var(--shadow-cta)]"
      )}
    >
      {isTopPick && (
        <div className="mb-3 inline-flex items-center gap-1 rounded-full bg-accent text-accent-foreground px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">
          Top pick
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              {rec.rank}
            </span>
            <h3 className="font-semibold text-base leading-snug truncate">
              {rec.place}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{rec.address}</p>
        </div>
        {typeof rec.score === "number" && rec.score > 0 && (
          <div className="rounded-full bg-primary-soft text-primary px-2.5 py-1 text-xs font-bold shrink-0">
            {Math.round(rec.score)}
          </div>
        )}
      </div>

      {rec.order && (
        <div className="mt-3 rounded-2xl bg-primary-soft/60 p-3">
          <div className="text-[11px] uppercase tracking-wider text-primary font-semibold">
            Order this
          </div>
          <p className="text-sm mt-1">{rec.order}</p>
        </div>
      )}

      {flags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {flags.map((a) => (
            <AllergenFlag key={a} allergen={a} />
          ))}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MacroRangeBadge label="Calories" text={rec.calories} />
        <MacroRangeBadge label="Protein" text={rec.protein} />
        <MacroRangeBadge label="Carbs" text={rec.carbs} />
        <MacroRangeBadge label="Fat" text={rec.fat} />
      </div>

      {rec.confidence && (
        <div className="mt-3">
          <ConfidenceBadge level={rec.confidence} prefix="Macros" />
        </div>
      )}

      {rec.why && (
        <div className="mt-3">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            Why
          </div>
          <p className="text-sm mt-1 leading-relaxed">{rec.why}</p>
        </div>
      )}

      {rec.tradeoffs && (
        <div className="mt-2">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            Tradeoffs
          </div>
          <p className="text-sm mt-1 leading-relaxed text-muted-foreground">
            {rec.tradeoffs}
          </p>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {rec.sources_used.map((s) => (
            <span
              key={s}
              className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-medium"
            >
              {s}
            </span>
          ))}
        </div>
        {rec.google_maps_url && (
          <a
            href={rec.google_maps_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            Open in Maps <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}
