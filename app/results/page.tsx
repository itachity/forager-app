"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/forager/AppHeader";
import { RecommendationCard } from "@/components/forager/RecommendationCard";
import { ToolTracePanel } from "@/components/forager/ToolTracePanel";
import { SafetyNote } from "@/components/forager/SafetyNote";
import { DemoBanner } from "@/components/forager/DemoBanner";
import { BottomNav } from "@/components/forager/BottomNav";
import { loadProfileLocal } from "@/lib/forager-profile";
import { DEMO_CHAT } from "@/lib/forager-fallback";
import { useT } from "@/lib/forager-i18n-context";
import type { ChatResponse, UserProfile } from "@/lib/forager-types";

type Loaded = { profile: UserProfile | null; data: ChatResponse | null; demo: boolean };

function readLoaded(): Loaded {
  const profile = loadProfileLocal();
  try {
    const raw = sessionStorage.getItem("forager:lastChat");
    if (raw) {
      const parsed = JSON.parse(raw) as { data: ChatResponse; demo?: boolean };
      return { profile, data: parsed.data, demo: Boolean(parsed.demo) };
    }
  } catch (e) {
    console.warn(e);
  }
  return { profile, data: DEMO_CHAT, demo: true };
}

export default function ResultsPage() {
  const router = useRouter();
  const { t } = useT();
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

  const { profile, data, demo } = loaded;

  return (
    <main className="min-h-screen pb-32">
      <AppHeader backHref="/home" />

      <div className="max-w-xl mx-auto px-5 pt-2 space-y-4">
        {demo && <DemoBanner />}

        {data.answer && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {data.answer}
          </p>
        )}

        <div className="space-y-3">
          {data.recommendations.map((r, i) => (
            <RecommendationCard
              key={`${r.place}-${i}`}
              rec={r}
              isTopPick={i === 0}
              profile={profile}
            />
          ))}
        </div>

        <ToolTracePanel trace={data.tool_trace} />

        <SafetyNote>{t("results.safety")}</SafetyNote>
      </div>

      <BottomNav />
    </main>
  );
}
