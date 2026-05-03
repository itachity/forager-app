"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/forager/AppHeader";
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
  const [loaded, setLoaded] = useState<Loaded>({
    profile: null,
    data: null,
    demo: false,
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const next = readLoaded();
    if (!next.profile) router.replace("/onboarding");
    setLoaded(next);
    setMounted(true);
  }, [router]);

  if (!mounted || !loaded.profile || !loaded.data) {
    return <main className="min-h-screen" suppressHydrationWarning />;
  }

  return (
    <>
      <AppHeader backHref="/scan/food" />
      {loaded.demo && (
        <div className="max-w-xl mx-auto px-5 pt-2">
          <DemoBanner />
        </div>
      )}
      <ScanFoodResult
        initial={loaded.data}
        profile={loaded.profile}
        previewUrl={loaded.previewUrl}
      />
      <BottomNav />
    </>
  );
}
