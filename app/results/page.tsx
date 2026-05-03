"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ForagerLogo } from "@/components/forager/ForagerLogo";
import { FauxMap } from "@/components/forager/FauxMap";
import { RecommendationCard } from "@/components/forager/RecommendationCard";
import { ToolTracePanel } from "@/components/forager/ToolTracePanel";
import { SafetyNote } from "@/components/forager/SafetyNote";
import { DemoBanner } from "@/components/forager/DemoBanner";
import { BottomNav } from "@/components/forager/BottomNav";
import { loadProfileLocal } from "@/lib/forager-profile";
import { DEMO_CHAT } from "@/lib/forager-fallback";
import type { ChatResponse, UserProfile } from "@/lib/forager-types";

export default function ResultsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [data, setData] = useState<ChatResponse | null>(null);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    const p = loadProfileLocal();
    if (!p) {
      router.replace("/onboarding");
      return;
    }
    setProfile(p);
    try {
      const raw = sessionStorage.getItem("forager:lastChat");
      if (raw) {
        const parsed = JSON.parse(raw) as { data: ChatResponse; demo?: boolean };
        setData(parsed.data);
        setDemo(Boolean(parsed.demo));
      } else {
        // Direct nav with no session payload — show demo so the UI is meaningful.
        setData(DEMO_CHAT);
        setDemo(true);
      }
    } catch (e) {
      console.warn(e);
      setData(DEMO_CHAT);
      setDemo(true);
    }
  }, [router]);

  if (!profile || !data) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-32">
      <div className="px-5 pt-4 pb-3 sticky top-0 z-10 bg-background/95 backdrop-blur">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <Link
            href="/home"
            aria-label="Back to search"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary hover:bg-muted transition"
          >
            <ArrowLeft size={18} />
          </Link>
          <ForagerLogo size="sm" />
          <div className="w-9" />
        </div>
      </div>

      <div className="max-w-xl mx-auto px-5 pt-4 space-y-4">
        {demo && <DemoBanner />}

        <FauxMap recommendations={data.recommendations} />

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

        <SafetyNote>
          Allergen calls are best-effort. Verify with the restaurant before ordering if you have a strict dietary need.
        </SafetyNote>
      </div>

      <BottomNav />
    </main>
  );
}
