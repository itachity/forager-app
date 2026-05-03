"use client";

import { Pill } from "@/components/forager/Pill";
import { DIET_RULE_LABELS, SPICE_LABELS } from "@/lib/forager-mappings";
import { StepBody, StepHeader, type StepProps } from "./_shared";

export function Step3Diet({ profile, update }: StepProps) {
  const rules = profile.dietary.dietRules;
  const spice = profile.dietary.spiceTolerance;

  return (
    <StepBody>
      <StepHeader
        eyebrow="Diet"
        title="How do you like to eat?"
        description="Pick any that apply — we'll respect every one."
      />
      <div className="flex flex-wrap gap-2">
        {DIET_RULE_LABELS.map(({ label, key }) => (
          <Pill
            key={key}
            selected={rules[key]}
            onClick={() =>
              update({
                dietary: {
                  ...profile.dietary,
                  dietRules: { ...rules, [key]: !rules[key] },
                },
              })
            }
          >
            {label}
          </Pill>
        ))}
      </div>

      <div className="mt-8">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
          Spice tolerance
        </div>
        <div className="flex flex-wrap gap-2">
          {SPICE_LABELS.map(({ label, value }) => (
            <Pill
              key={value}
              selected={spice === value}
              onClick={() =>
                update({
                  dietary: { ...profile.dietary, spiceTolerance: value },
                })
              }
            >
              {label}
            </Pill>
          ))}
        </div>
      </div>
    </StepBody>
  );
}
