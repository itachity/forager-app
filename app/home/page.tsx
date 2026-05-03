"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Languages } from "lucide-react";
import { ForagerLogo } from "@/components/forager/ForagerLogo";
import { SearchPanel } from "@/components/forager/SearchPanel";
import { ScanEntryCard } from "@/components/forager/ScanEntryCard";
import { BottomNav } from "@/components/forager/BottomNav";
import { loadProfileLocal } from "@/lib/forager-profile";
import type { UserProfile } from "@/lib/forager-types";

export default function HomePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const p = loadProfileLocal();
    if (!p) {
      router.replace("/onboarding");
      return;
    }
    setProfile(p);
  }, [router]);

  if (!profile) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-32">
      <div className="max-w-xl mx-auto px-5 pt-6">
        <div className="flex flex-col items-center text-center mb-5">
          <ForagerLogo size="lg" />
          <p className="text-sm text-muted-foreground mt-1">
            Discover your next food adventure
          </p>
        </div>

        <SearchPanel profile={profile} />

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ScanEntryCard
            href="/scan/food"
            icon={<Camera size={22} />}
            title="Snap your meal"
            description="Identify a dish, estimate macros, log it."
          />
          <ScanEntryCard
            href="/scan/menu"
            icon={<Languages size={22} />}
            title="Translate a menu"
            description="Decode any menu and rank dishes for you."
          />
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
