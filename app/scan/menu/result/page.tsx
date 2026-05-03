"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/forager/AppHeader";
import { ScanMenuResult } from "@/components/forager/ScanMenuResult";
import { DemoBanner } from "@/components/forager/DemoBanner";
import { BottomNav } from "@/components/forager/BottomNav";
import { loadProfileLocal } from "@/lib/forager-profile";
import { DEMO_MENU_ANALYSIS } from "@/lib/forager-fallback";
import type { AnalyzeMenuResponse, UserProfile } from "@/lib/forager-types";

type Loaded = {
  profile: UserProfile | null;
  data: AnalyzeMenuResponse | null;
  demo: boolean;
};

function readLoaded(): Loaded {
  if (typeof window === "undefined") return { profile: null, data: null, demo: false };
  const profile = loadProfileLocal();
  try {
    const raw = sessionStorage.getItem("forager:lastMenu");
    if (raw) {
      const parsed = JSON.parse(raw) as { data: AnalyzeMenuResponse; demo?: boolean };
      return { profile, data: parsed.data, demo: Boolean(parsed.demo) };
    }
  } catch (e) {
    console.warn(e);
  }
  return { profile, data: DEMO_MENU_ANALYSIS, demo: true };
}

export default function ScanMenuResultPage() {
  const router = useRouter();
  const [{ profile, data, demo }] = useState<Loaded>(readLoaded);

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
      <AppHeader backHref="/scan/menu" />
      {demo && (
        <div className="max-w-xl mx-auto px-5 pt-2">
          <DemoBanner />
        </div>
      )}
      <ScanMenuResult data={data} profile={profile} />
      <BottomNav />
    </>
  );
}
