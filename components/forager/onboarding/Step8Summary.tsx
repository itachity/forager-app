"use client";

import { Sparkles } from "lucide-react";
import { IconBadge } from "@/components/forager/IconBadge";
import {
  activeDietRules,
  budgetLabelOf,
  goalLabelOf,
  languageLabelOf,
  spiceLabelOf,
} from "@/lib/forager-mappings";
import { StepBody, StepHeader, type StepProps } from "./_shared";

export function Step8Summary({ profile }: StepProps) {
  const diet = activeDietRules(profile.dietary.dietRules);
  const allergens = profile.dietary.allergens;
  const cuisines = profile.preferences.likedCuisines;

  const cells: { label: string; value: string }[] = [
    { label: "Language", value: languageLabelOf(profile.language.preferredLanguage) },
    { label: "Spice", value: spiceLabelOf(profile.dietary.spiceTolerance) },
    { label: "Budget", value: budgetLabelOf(profile.preferences.budget) },
    { label: "Distance", value: `${profile.preferences.maxDistanceMiles} mi` },
    { label: "Goal", value: goalLabelOf(profile.nutritionGoals.goalType) },
    { label: "Diet rules", value: diet.length ? diet.join(", ") : "Open to anything" },
    { label: "Allergies", value: allergens.length ? allergens.join(", ") : "None" },
    { label: "Loved cuisines", value: cuisines.length ? cuisines.join(", ") : "Surprise me" },
  ];

  return (
    <StepBody>
      <div className="flex flex-col items-center text-center mb-6">
        <IconBadge tone="orange">
          <Sparkles />
        </IconBadge>
        <div className="mt-4">
          <StepHeader
            title="You&rsquo;re ready to forage"
            description="Here&rsquo;s a snapshot of your taste profile."
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {cells.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl bg-secondary/60 p-3"
          >
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              {c.label}
            </div>
            <div className="mt-1 text-sm font-medium leading-snug break-words">
              {c.value}
            </div>
          </div>
        ))}
      </div>
    </StepBody>
  );
}
