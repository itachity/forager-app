"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/forager/AppHeader";
import { ScanCapture } from "@/components/forager/ScanCapture";
import { ScanModeToggle } from "@/components/forager/ScanModeToggle";
import { BottomNav } from "@/components/forager/BottomNav";
import { useToast } from "@/components/forager/ToastProvider";
import { analyzeFood } from "@/lib/forager-api";
import { loadProfileLocal } from "@/lib/forager-profile";
import { useT } from "@/lib/forager-i18n-context";
import type { UserProfile } from "@/lib/forager-types";

export default function ScanFoodPage() {
  const router = useRouter();
  const toast = useToast();
  const { t } = useT();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const p = loadProfileLocal();
    if (!p) router.replace("/onboarding");
    else setProfile(p);
    setMounted(true);
  }, [router]);

  const onSubmit = async (file: File) => {
    if (!profile) return;
    setBusy(true);
    try {
      const previewUrl = await fileToDataUrl(file);
      const res = await analyzeFood(file, profile);
      const data = res.data;
      if (!data) {
        toast.show(t("scan.food.errorAnalyze"), "error");
        setBusy(false);
        return;
      }
      sessionStorage.setItem(
        "forager:lastFood",
        JSON.stringify({ data, demo: !res.ok || res.demo === true, previewUrl })
      );
      router.push("/scan/food/result");
    } catch (e) {
      console.error(e);
      toast.show(t("scan.food.errorFailed"), "error");
      setBusy(false);
    }
  };

  if (!mounted || !profile) {
    return <main className="min-h-screen" suppressHydrationWarning />;
  }

  return (
    <>
      <AppHeader backHref="/home" />
      <div className="max-w-xl mx-auto px-5 pt-2 pb-2">
        <ScanModeToggle active="food" />
      </div>
      <ScanCapture
        eyebrow={t("scan.food.eyebrow")}
        heading={t("scan.food.heading")}
        subtitle={t("scan.food.subtitle")}
        helperPrimary={t("scan.food.helperPrimary")}
        helperSecondary={t("scan.food.helperSecondary")}
        onSubmit={onSubmit}
        busy={busy}
        loadingMessage={t("scan.food.loading")}
        loadingDetail={t("scan.food.loadingDetail")}
      />
      <BottomNav />
    </>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
