"use client";

import { GOAL_LABELS } from "@/lib/forager-mappings";
import { cn } from "@/lib/utils";
import { NumberField, StepBody, StepHeader, type StepProps } from "./_shared";

export function Step5Nutrition({ profile, update }: StepProps) {
  const goal = profile.nutritionGoals.goalType;

  return (
    <StepBody>
      <StepHeader
        eyebrow="Nutrition"
        title="What's your nutrition goal?"
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {GOAL_LABELS.map(({ label, emoji, value }) => {
          const active = goal === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() =>
                update({
                  nutritionGoals: { ...profile.nutritionGoals, goalType: value },
                })
              }
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-sm transition",
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card border-border text-foreground hover:border-primary/40 hover:bg-primary-soft"
              )}
            >
              <span className="text-2xl">{emoji}</span>
              <span className="font-medium leading-tight text-center">{label}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-8 grid grid-cols-3 gap-3">
        <NumberField
          label="Max calories"
          value={profile.nutritionGoals.caloriesMax}
          suffix="kcal"
          placeholder="800"
          onChange={(v) =>
            update({
              nutritionGoals: { ...profile.nutritionGoals, caloriesMax: v },
            })
          }
        />
        <NumberField
          label="Min protein"
          value={profile.nutritionGoals.proteinMinGrams}
          suffix="g"
          placeholder="30"
          onChange={(v) =>
            update({
              nutritionGoals: { ...profile.nutritionGoals, proteinMinGrams: v },
            })
          }
        />
        <NumberField
          label="Max carbs"
          value={profile.nutritionGoals.carbsMaxGrams}
          suffix="g"
          placeholder="60"
          onChange={(v) =>
            update({
              nutritionGoals: { ...profile.nutritionGoals, carbsMaxGrams: v },
            })
          }
        />
      </div>
    </StepBody>
  );
}
