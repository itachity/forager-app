"use client";

import { Pill } from "@/components/forager/Pill";
import { LANGUAGE_LABELS } from "@/lib/forager-mappings";
import { StepBody, StepHeader, ToggleRow, type StepProps } from "./_shared";

export function Step2Language({ profile, update }: StepProps) {
  const current = profile.language.preferredLanguage;
  return (
    <StepBody>
      <StepHeader
        eyebrow="Language"
        title="Pick your preferred language"
        description="We'll translate menus and explain dishes in this language."
      />
      <div className="flex flex-wrap gap-2">
        {LANGUAGE_LABELS.map(({ label, value }) => (
          <Pill
            key={value}
            selected={current === value}
            onClick={() =>
              update({
                language: { ...profile.language, preferredLanguage: value },
              })
            }
          >
            {label}
          </Pill>
        ))}
      </div>

      <div className="mt-8">
        <ToggleRow
          label="Explain cultural norms"
          description="Learn the etiquette behind unfamiliar dishes."
          checked={profile.language.explainCulturalNorms}
          onChange={(v) =>
            update({
              language: { ...profile.language, explainCulturalNorms: v },
            })
          }
        />
      </div>
    </StepBody>
  );
}
