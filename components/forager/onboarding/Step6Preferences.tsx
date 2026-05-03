"use client";

import { Pill } from "@/components/forager/Pill";
import { BUDGET_LABELS, CUISINES } from "@/lib/forager-mappings";
import { StepBody, StepHeader, type StepProps } from "./_shared";

export function Step6Preferences({ profile, update }: StepProps) {
  const budget = profile.preferences.budget;
  const distance = profile.preferences.maxDistanceMiles;
  const liked = new Set(profile.preferences.likedCuisines);

  const toggleCuisine = (c: string) => {
    const next = new Set(liked);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    update({
      preferences: {
        ...profile.preferences,
        likedCuisines: Array.from(next),
      },
    });
  };

  return (
    <StepBody>
      <StepHeader
        eyebrow="Preferences"
        title="What kind of foraging suits you?"
      />

      <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
        Budget
      </div>
      <div className="flex flex-wrap gap-2">
        {BUDGET_LABELS.map(({ label, value }) => (
          <Pill
            key={value}
            selected={budget === value}
            onClick={() =>
              update({
                preferences: { ...profile.preferences, budget: value },
              })
            }
          >
            {label}
          </Pill>
        ))}
      </div>

      <div className="mt-8 text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
        Max distance
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={1}
          max={25}
          step={1}
          value={distance}
          onChange={(e) =>
            update({
              preferences: {
                ...profile.preferences,
                maxDistanceMiles: Number(e.target.value),
              },
            })
          }
          className="flex-1 accent-[var(--primary)]"
          aria-label="Max distance in miles"
        />
        <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground min-w-[3rem] text-center">
          {distance} mi
        </span>
      </div>

      <div className="mt-8 text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
        Cuisines you love
      </div>
      <div className="flex flex-wrap gap-2">
        {CUISINES.map((c) => (
          <Pill key={c} selected={liked.has(c)} onClick={() => toggleCuisine(c)}>
            {c}
          </Pill>
        ))}
      </div>
    </StepBody>
  );
}
