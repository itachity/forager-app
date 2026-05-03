"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScanHeader } from "@/components/forager/ScanHeader";
import { ScanCapture } from "@/components/forager/ScanCapture";
import { BottomNav } from "@/components/forager/BottomNav";
import { useToast } from "@/components/forager/ToastProvider";
import { analyzeMenu } from "@/lib/forager-api";
import { loadProfileLocal } from "@/lib/forager-profile";
import type { UserProfile } from "@/lib/forager-types";

export default function ScanMenuPage() {
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
      const res = await analyzeMenu(file, profile);
      const data = res.data;
      if (!data) {
        toast.show("Couldn't translate this menu.", "error");
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
      toast.show("Failed to translate. Showing demo data.", "error");
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
        heading="Translate a menu"
        subtitle="We'll translate the menu, flag your allergens, and rank dishes for you — plus phrases for the server."
        helperPrimary="Take or upload a photo"
        helperSecondary="Get the whole menu in frame, even if it's blurry — Forager will do its best."
        onSubmit={onSubmit}
        busy={busy}
        loadingMessage="Translating & ranking dishes…"
        loadingDetail="Reading the menu and learning the cuisine's etiquette."
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
