"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Languages } from "lucide-react";
import { AppHeader } from "@/components/forager/AppHeader";
import { SearchPanel } from "@/components/forager/SearchPanel";
import { ScanEntryCard } from "@/components/forager/ScanEntryCard";
import { BottomNav } from "@/components/forager/BottomNav";
import { loadProfileLocal } from "@/lib/forager-profile";
import { useT } from "@/lib/forager-i18n-context";
import type { UserProfile } from "@/lib/forager-types";

export default function HomePage() {
  const router = useRouter();
  const { t } = useT();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const p = loadProfileLocal();
    if (!p) {
      router.replace("/onboarding");
    } else {
      setProfile(p);
    }
    setMounted(true);
  }, [router]);

  if (!mounted || !profile) {
    return <main className="min-h-screen" suppressHydrationWarning />;
  }

  return (
    <main className="min-h-screen pb-32">
      <AppHeader />
      <div className="max-w-xl mx-auto px-5 pt-2">
        <p className="text-sm text-muted-foreground text-center mb-5">
          {t("home.tagline")}
        </p>

        <SearchPanel profile={profile} />

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ScanEntryCard
            href="/scan/food"
            icon={<Camera size={22} />}
            title={t("home.snapMeal.title")}
            description={t("home.snapMeal.desc")}
          />
          <ScanEntryCard
            href="/scan/menu"
            icon={<Languages size={22} />}
            title={t("home.translateMenu.title")}
            description={t("home.translateMenu.desc")}
          />
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
