"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScanHeader } from "@/components/forager/ScanHeader";
import { ScanCapture } from "@/components/forager/ScanCapture";
import { BottomNav } from "@/components/forager/BottomNav";
import { useToast } from "@/components/forager/ToastProvider";
import { analyzeFood } from "@/lib/forager-api";
import { loadProfileLocal } from "@/lib/forager-profile";
import type { UserProfile } from "@/lib/forager-types";

export default function ScanFoodPage() {
  const router = useRouter();
  const toast = useToast();
  const [profile] = useState<UserProfile | null>(() =>
    typeof window === "undefined" ? null : loadProfileLocal()
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && !profile) {
      router.replace("/onboarding");
    }
  }, [profile, router]);

  const onSubmit = async (file: File) => {
    if (!profile) return;
    setBusy(true);
    try {
      const previewUrl = await fileToDataUrl(file);
      const res = await analyzeFood(file, profile);
      const data = res.data;
      if (!data) {
        toast.show("Couldn't analyze this image.", "error");
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
      toast.show("Failed to analyze. Showing demo data.", "error");
      setBusy(false);
    }
  };

  if (!profile) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </main>
    );
  }

  return (
    <>
      <ScanHeader />
      <ScanCapture
        eyebrow="Scan"
        heading="Snap your meal"
        subtitle="We'll identify the dish, estimate macros, and suggest how to log it."
        helperPrimary="Take or upload a photo"
        helperSecondary="Best results with good lighting and the whole plate visible."
        onSubmit={onSubmit}
        busy={busy}
        loadingMessage="Identifying your meal…"
        loadingDetail="Naming ingredients and estimating macros."
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
