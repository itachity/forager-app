"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, User as UserIcon } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ForagerLogo } from "@/components/forager/ForagerLogo";
import { useToast } from "@/components/forager/ToastProvider";
import { signInWithGoogle, supabaseAvailable } from "@/lib/forager-supabase";
import { defaultProfile, persistProfile } from "@/lib/forager-profile";
import { useT } from "@/lib/forager-i18n-context";

export default function WelcomePage() {
  const router = useRouter();
  const toast = useToast();
  const { t } = useT();
  const [busy, setBusy] = useState(false);

  const foodWords = useMemo(
    () =>
      t("landing.foodWords")
        .split(",")
        .map((w) => w.trim())
        .filter(Boolean),
    [t]
  );
  const [wordIdx, setWordIdx] = useState(0);

  useEffect(() => {
    if (foodWords.length <= 1) return;
    const id = window.setInterval(() => {
      setWordIdx((i) => (i + 1) % foodWords.length);
    }, 1800);
    return () => window.clearInterval(id);
  }, [foodWords.length]);

  const onGoogle = async () => {
    if (!supabaseAvailable) {
      toast.show(
        "Google sign-in isn't configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
        "error"
      );
      return;
    }
    setBusy(true);
    const res = await signInWithGoogle("/onboarding");
    if (!res.ok) {
      toast.show(res.reason ?? "Sign-in failed", "error");
      setBusy(false);
    }
  };

  const onGuest = async () => {
    const guest = { ...defaultProfile(), profileMode: "guest" as const };
    await persistProfile(guest);
    router.push("/onboarding");
  };

  return (
    <main className="forager-aurora relative min-h-screen overflow-hidden flex flex-col">
      {/* Decorative floating food emoji — purely visual */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <span
          className="forager-float absolute top-[12%] left-[8%] text-5xl opacity-40 select-none"
          style={{ ["--rot" as string]: "-12deg", animationDelay: "0s" }}
        >
          🍜
        </span>
        <span
          className="forager-float absolute top-[20%] right-[10%] text-4xl opacity-40 select-none"
          style={{ ["--rot" as string]: "10deg", animationDelay: "1.2s" }}
        >
          🌮
        </span>
        <span
          className="forager-float absolute bottom-[28%] left-[14%] text-4xl opacity-40 select-none"
          style={{ ["--rot" as string]: "8deg", animationDelay: "2.4s" }}
        >
          🥢
        </span>
        <span
          className="forager-float absolute bottom-[18%] right-[12%] text-5xl opacity-40 select-none"
          style={{ ["--rot" as string]: "-8deg", animationDelay: "3.6s" }}
        >
          🥑
        </span>
      </div>

      <div className="relative px-6 pt-10 max-w-xl mx-auto w-full flex-1 flex flex-col">
        <div
          className="flex justify-center mb-8 animate-in fade-in slide-in-from-top-2 duration-700"
          style={{ animationDelay: "0ms", animationFillMode: "both" }}
        >
          <ForagerLogo size="lg" />
        </div>

        <div
          className="flex justify-center mb-6 animate-in fade-in zoom-in-90 duration-700"
          style={{ animationDelay: "120ms", animationFillMode: "both" }}
        >
          <Image
            src="/icon.png"
            alt="Forager app icon"
            width={120}
            height={120}
            className="rounded-3xl shadow-lg"
            priority
          />
        </div>

        <h1
          className="text-4xl md:text-5xl font-semibold tracking-tight text-center leading-tight animate-in fade-in slide-in-from-bottom-3 duration-700"
          style={{ animationDelay: "240ms", animationFillMode: "both" }}
        >
          {t("landing.tagline")}
        </h1>

        {/* Rotating cuisine word */}
        <div
          className="mt-4 flex justify-center text-sm md:text-base animate-in fade-in duration-700"
          style={{ animationDelay: "320ms", animationFillMode: "both" }}
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-card/70 backdrop-blur px-4 py-1.5 border border-border/60 shadow-sm">
            <span className="text-muted-foreground">→</span>
            <span
              key={`${wordIdx}-${foodWords[wordIdx] ?? ""}`}
              className="font-medium text-primary animate-in fade-in slide-in-from-bottom-1 duration-500"
            >
              {foodWords[wordIdx] ?? ""}
            </span>
          </span>
        </div>

        <p
          className="mt-4 text-muted-foreground leading-relaxed text-center animate-in fade-in duration-700"
          style={{ animationDelay: "400ms", animationFillMode: "both" }}
        >
          {t("landing.subtagline")}
        </p>

        <div
          className="mt-8 space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-700"
          style={{ animationDelay: "520ms", animationFillMode: "both" }}
        >
          <Button
            variant="cta"
            size="xl"
            className="w-full transition-transform hover:-translate-y-0.5 active:translate-y-0"
            onClick={onGoogle}
            disabled={busy}
          >
            {t("landing.continueGoogle")} <ArrowRight />
          </Button>
          <Button
            variant="outline"
            size="xl"
            className="w-full rounded-2xl transition-transform hover:-translate-y-0.5 active:translate-y-0"
            onClick={onGuest}
            disabled={busy}
          >
            <UserIcon /> {t("landing.continueGuest")}
          </Button>
        </div>

        <p
          className="mt-6 mb-10 text-center text-xs text-muted-foreground animate-in fade-in duration-700"
          style={{ animationDelay: "640ms", animationFillMode: "both" }}
        >
          {t("landing.terms")}
        </p>
      </div>
    </main>
  );
}
