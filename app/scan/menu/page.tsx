"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/forager/AppHeader";
import { ScanCapture } from "@/components/forager/ScanCapture";
import { ScanModeToggle } from "@/components/forager/ScanModeToggle";
import { BottomNav } from "@/components/forager/BottomNav";
import { useToast } from "@/components/forager/ToastProvider";
import { analyzeMenu } from "@/lib/forager-api";
import { loadProfileLocal } from "@/lib/forager-profile";
import { useT } from "@/lib/forager-i18n-context";
import type { UserProfile } from "@/lib/forager-types";

export default function ScanMenuPage() {
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
      const res = await analyzeMenu(file, profile);
      const data = res.data;
      if (!data) {
        toast.show(t("scan.menu.errorAnalyze"), "error");
        setBusy(false);
        return;
      }
      sessionStorage.setItem(
        "forager:lastMenu",
        JSON.stringify({ data, demo: !res.ok || res.demo === true, previewUrl })
      );
      router.push("/scan/menu/result");
    } catch (e) {
      console.error(e);
      toast.show(t("scan.menu.errorFailed"), "error");
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
        <ScanModeToggle active="menu" />
      </div>
      <ScanCapture
        eyebrow={t("scan.menu.eyebrow")}
        heading={t("scan.menu.heading")}
        subtitle={t("scan.menu.subtitle")}
        helperPrimary={t("scan.menu.helperPrimary")}
        helperSecondary={t("scan.menu.helperSecondary")}
        onSubmit={onSubmit}
        busy={busy}
        loadingMessage={t("scan.menu.loading")}
        loadingDetail={t("scan.menu.loadingDetail")}
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
