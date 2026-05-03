"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressHeader } from "@/components/forager/ProgressHeader";
import { useToast } from "@/components/forager/ToastProvider";
import {
  defaultProfile,
  loadProfileLocal,
  persistProfile,
} from "@/lib/forager-profile";
import { getAuthUser, loadProfile as loadProfileRemote } from "@/lib/forager-supabase";
import type { UserProfile } from "@/lib/forager-types";
import { Step2Language } from "./Step2Language";
import { Step3Diet } from "./Step3Diet";
import { Step4Allergy } from "./Step4Allergy";
import { Step5Nutrition } from "./Step5Nutrition";
import { Step6Preferences } from "./Step6Preferences";
import { Step7Privacy } from "./Step7Privacy";
import { Step8Summary } from "./Step8Summary";

const TOTAL_STEPS = 8;
const FIRST_INTERNAL = 2;

export function OnboardingWizard() {
  const router = useRouter();
  const toast = useToast();
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [stepIndex, setStepIndex] = useState(0); // 0..6
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = loadProfileLocal();
      const user = await getAuthUser();
      let next: UserProfile = local ?? defaultProfile();
      if (user && local?.profileMode !== "guest") {
        const remote = await loadProfileRemote(user.id);
        if (remote) next = remote;
        next = {
          ...next,
          authUserId: user.id,
          email: user.email ?? next.email ?? null,
          displayName: user.displayName ?? next.displayName ?? null,
          profileMode: next.profileMode === "guest" ? "normal" : next.profileMode,
        };
      }
      if (cancelled) return;
      setProfile(next);
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (patch: Partial<UserProfile>) => {
    setProfile((p) => {
      const next: UserProfile = {
        ...p,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      void persistProfile(next);
      return next;
    });
  };


  const displayStep = stepIndex + FIRST_INTERNAL; // 2..8
  const isLast = stepIndex === 6;

  const goNext = () => {
    if (isLast) {
      void persistProfile(profile);
      router.push("/home");
      toast.show("Profile saved — welcome to Forager.", "success");
      return;
    }
    setStepIndex((s) => Math.min(s + 1, 6));
  };

  const goBack = () => {
    if (stepIndex === 0) {
      router.push("/");
      return;
    }
    setStepIndex((s) => Math.max(s - 1, 0));
  };

  const screen = useMemo(() => {
    const props = { profile, update };
    switch (stepIndex) {
      case 0: return <Step2Language {...props} />;
      case 1: return <Step3Diet {...props} />;
      case 2: return <Step4Allergy {...props} />;
      case 3: return <Step5Nutrition {...props} />;
      case 4: return <Step6Preferences {...props} />;
      case 5: return <Step7Privacy {...props} />;
      case 6: return <Step8Summary {...props} />;
      default: return null;
    }
  }, [stepIndex, profile]);

  if (!hydrated) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading your profile…
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col bg-background">
      <ProgressHeader step={displayStep} total={TOTAL_STEPS} onBack={goBack} />
      <div className="flex-1 px-5 pt-6 pb-32">{screen}</div>
      <div className="fixed inset-x-0 bottom-0 z-20 px-5 pb-5 pt-4 bg-gradient-to-t from-background via-background/95 to-background/0">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <Button
            variant="ghost"
            size="lg"
            className="text-muted-foreground"
            onClick={goBack}
          >
            <ArrowLeft /> Back
          </Button>
          <Button
            variant="cta"
            size="xl"
            className="flex-1"
            onClick={goNext}
          >
            {isLast ? (
              <>
                <Check /> Start Foraging
              </>
            ) : (
              <>
                Next <ArrowRight />
              </>
            )}
          </Button>
        </div>
      </div>
    </main>
  );
}
