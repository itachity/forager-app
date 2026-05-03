"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScanHeader } from "@/components/forager/ScanHeader";
import { ScanFoodResult } from "@/components/forager/ScanFoodResult";
import { DemoBanner } from "@/components/forager/DemoBanner";
import { BottomNav } from "@/components/forager/BottomNav";
import { loadProfileLocal } from "@/lib/forager-profile";
import { DEMO_FOOD_ANALYSIS } from "@/lib/forager-fallback";
import type { AnalyzeFoodResponse, UserProfile } from "@/lib/forager-types";

type Loaded = {
  profile: UserProfile | null;
  data: AnalyzeFoodResponse | null;
  demo: boolean;
  previewUrl?: string;
};

function readLoaded(): Loaded {
  if (typeof window === "undefined") return { profile: null, data: null, demo: false };
  const profile = loadProfileLocal();
  try {
    const raw = sessionStorage.getItem("forager:lastFood");
    if (raw) {
      const parsed = JSON.parse(raw) as {
        data: AnalyzeFoodResponse;
        demo?: boolean;
        previewUrl?: string;
      };
      return {
        profile,
        data: parsed.data,
        demo: Boolean(parsed.demo),
        previewUrl: parsed.previewUrl,
      };
    }
  } catch (e) {
    console.warn(e);
  }
  return { profile, data: DEMO_FOOD_ANALYSIS, demo: true };
}

export default function ScanFoodResultPage() {
  const router = useRouter();
  const [{ profile, data, demo, previewUrl }] = useState<Loaded>(readLoaded);

  useEffect(() => {
    if (typeof window !== "undefined" && !profile) {
      router.replace("/onboarding");
    }
  }, [profile, router]);

  if (!profile || !data) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </main>
    );
  }

  return (
    <>
      <ScanHeader backHref="/scan/food" />
      {demo && (
        <div className="max-w-xl mx-auto px-5 pt-2">
          <DemoBanner />
        </div>
      )}
      <ScanFoodResult initial={data} profile={profile} previewUrl={previewUrl} />
      <BottomNav />
    </>
  );
}
