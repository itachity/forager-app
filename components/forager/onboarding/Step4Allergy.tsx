"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Pill } from "@/components/forager/Pill";
import { Input } from "@/components/ui/input";
import { COMMON_ALLERGENS } from "@/lib/forager-mappings";
import { StepBody, StepHeader, type StepProps } from "./_shared";

export function Step4Allergy({ profile, update }: StepProps) {
  const [allergenInput, setAllergenInput] = useState("");
  const [avoidInput, setAvoidInput] = useState("");

  const addAllergen = (val: string) => {
    const v = val.trim();
    if (!v || profile.dietary.allergens.includes(v)) return;
    update({
      dietary: { ...profile.dietary, allergens: [...profile.dietary.allergens, v] },
    });
  };
  const removeAllergen = (v: string) =>
    update({
      dietary: {
        ...profile.dietary,
        allergens: profile.dietary.allergens.filter((a) => a !== v),
      },
    });

  const addAvoid = (val: string) => {
    const v = val.trim();
    if (!v || profile.dietary.avoidIngredients.includes(v)) return;
    update({
      dietary: {
        ...profile.dietary,
        avoidIngredients: [...profile.dietary.avoidIngredients, v],
      },
    });
  };
  const removeAvoid = (v: string) =>
    update({
      dietary: {
        ...profile.dietary,
        avoidIngredients: profile.dietary.avoidIngredients.filter((a) => a !== v),
      },
    });

  return (
    <StepBody>
      <StepHeader
        eyebrow="Safety first"
        title="Any allergies or no-go ingredients?"
        description="We'll filter these out of every recommendation."
      />

      <label className="text-sm font-medium text-foreground">Allergies</label>
      <Input
        placeholder="Type and press Enter (e.g. Peanuts)"
        className="mt-2 h-11 rounded-2xl bg-secondary/60 border-transparent"
        value={allergenInput}
        onChange={(e) => setAllergenInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addAllergen(allergenInput);
            setAllergenInput("");
          }
        }}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {COMMON_ALLERGENS.map((a) => (
          <Pill
            key={a}
            selected={profile.dietary.allergens.includes(a)}
            onClick={() =>
              profile.dietary.allergens.includes(a) ? removeAllergen(a) : addAllergen(a)
            }
          >
            {a}
          </Pill>
        ))}
      </div>
      {profile.dietary.allergens.filter((a) => !COMMON_ALLERGENS.includes(a)).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {profile.dietary.allergens
            .filter((a) => !COMMON_ALLERGENS.includes(a))
            .map((a) => (
              <span
                key={a}
                className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 text-destructive px-3 py-1.5 text-sm font-medium"
              >
                {a}
                <button
                  type="button"
                  onClick={() => removeAllergen(a)}
                  aria-label={`Remove ${a}`}
                >
                  <X size={14} />
                </button>
              </span>
            ))}
        </div>
      )}

      <label className="mt-8 block text-sm font-medium text-foreground">
        Ingredients to avoid
      </label>
      <Input
        placeholder="e.g. cilantro, mushrooms"
        className="mt-2 h-11 rounded-2xl bg-secondary/60 border-transparent"
        value={avoidInput}
        onChange={(e) => setAvoidInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addAvoid(avoidInput);
            setAvoidInput("");
          }
        }}
      />
      {profile.dietary.avoidIngredients.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {profile.dietary.avoidIngredients.map((a) => (
            <span
              key={a}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm font-medium"
            >
              {a}
              <button
                type="button"
                onClick={() => removeAvoid(a)}
                aria-label={`Remove ${a}`}
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}
    </StepBody>
  );
}
