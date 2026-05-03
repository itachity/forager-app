"use client";

import { StepBody, StepHeader, ToggleRow, type StepProps } from "./_shared";

export function Step7Privacy({
  profile,
  update,
  cheatDay,
  onCheatDay,
}: StepProps & {
  cheatDay: boolean;
  onCheatDay: (v: boolean) => void;
}) {
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

      <div className="mt-6 pt-6 border-t border-border/60">
        <ToggleRow
          variant="accent"
          label="Cheat day"
          description="Temporarily ignore your profile and surface anything tasty."
          checked={cheatDay}
          onChange={onCheatDay}
        />
      </div>
    </StepBody>
  );
}
