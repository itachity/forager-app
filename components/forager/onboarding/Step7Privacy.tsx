"use client";

import { StepBody, StepHeader, ToggleRow, type StepProps } from "./_shared";

export function Step7Privacy({
  profile,
  update,
}: StepProps) {
  return (
    <StepBody>
      <StepHeader
        eyebrow="Privacy"
        title="You're in control"
        description="Toggle what gets remembered. You can change these any time."
      />
      <div className="space-y-3">
        <ToggleRow
          label="Save location history"
          description="Helps suggest spots you'll actually return to."
          checked={profile.privacy.saveLocationHistory}
          onChange={(v) =>
            update({
              privacy: { ...profile.privacy, saveLocationHistory: v },
            })
          }
        />
        <ToggleRow
          label="Save meal history"
          description="Logs what you scan for personalized suggestions."
          checked={profile.privacy.saveMealHistory}
          onChange={(v) =>
            update({
              privacy: { ...profile.privacy, saveMealHistory: v },
            })
          }
        />
        <ToggleRow
          label="Use my profile for recommendations"
          description="Off = generic results that ignore your preferences."
          checked={profile.privacy.useProfileForRecommendations}
          onChange={(v) =>
            update({
              privacy: { ...profile.privacy, useProfileForRecommendations: v },
            })
          }
        />
      </div>
    </StepBody>
  );
}
