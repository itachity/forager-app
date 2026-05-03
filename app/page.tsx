"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, User as UserIcon } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ForagerLogo } from "@/components/forager/ForagerLogo";
import { useToast } from "@/components/forager/ToastProvider";
import { signInWithGoogle, supabaseAvailable } from "@/lib/forager-supabase";
import { defaultProfile, persistProfile } from "@/lib/forager-profile";

export default function WelcomePage() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const onGoogle = async () => {
    if (!supabaseAvailable) {
      toast.show("Google sign-in isn't configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.", "error");
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
    <main className="min-h-screen flex flex-col bg-[radial-gradient(circle_at_top,#fff7ef,transparent_50%),linear-gradient(#fcfcfa,#f6f5f1)]">
      <div className="px-6 pt-10 max-w-xl mx-auto w-full flex-1 flex flex-col">
        <div className="flex justify-center mb-8">
          <ForagerLogo size="lg" />
        </div>

        <div className="flex justify-center mb-6">
          <Image
            src="/icon.png"
            alt="Forager app icon"
            width={120}
            height={120}
            className="rounded-3xl shadow-lg"
            priority
          />
        </div>

        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-center leading-tight">
          Discover your next food adventure.
        </h1>
        <p className="mt-3 text-muted-foreground leading-relaxed text-center">
          Hidden food gems tailored to your taste, goals, and mood — from cozy late-night
          bites to your next high-protein bowl.
        </p>

        <div className="mt-8 space-y-3">
          <Button
            variant="cta"
            size="xl"
            className="w-full"
            onClick={onGoogle}
            disabled={busy}
          >
            Continue with Google <ArrowRight />
          </Button>
          <Button
            variant="outline"
            size="xl"
            className="w-full rounded-2xl"
            onClick={onGuest}
            disabled={busy}
          >
            <UserIcon /> Continue as guest
          </Button>
        </div>

        <p className="mt-6 mb-10 text-center text-xs text-muted-foreground">
          By continuing you agree to our Terms &amp; Privacy.
        </p>
      </div>
    </main>
  );
}
