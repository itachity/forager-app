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
import { FOOD_IMAGES } from "@/lib/forager-fallback";

export default function WelcomePage() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const onGoogle = async () => {
    if (!supabaseAvailable) {
      toast.show("Sign-in not configured for this build — continue as guest.", "default");
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
    <main className="min-h-screen flex flex-col">
      <div className="relative h-[44vh] md:h-[52vh] w-full overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={FOOD_IMAGES.hero}
          alt="A warm table of colorful, fresh dishes"
          className="absolute inset-0 h-full w-full object-cover"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
        <div className="absolute top-5 left-5">
          <ForagerLogo size="md" />
        </div>
        <div className="absolute bottom-6 right-5 max-w-[16rem] rounded-2xl bg-card/95 backdrop-blur p-3 shadow-lg border border-border/60">
          <div className="text-[10px] uppercase tracking-wider text-accent font-semibold">
            Today&rsquo;s pick
          </div>
          <div className="text-sm font-semibold mt-0.5">Green Harvest Bowl</div>
          <div className="text-xs text-muted-foreground">0.3 mi · Local Boys Grindz</div>
        </div>
      </div>

      <div className="px-6 -mt-6 relative z-10 max-w-xl mx-auto w-full">
        <div className="flex items-start gap-3 mb-2">
          <Image
            src="/icon.png"
            alt="Forager app icon"
            width={56}
            height={56}
            className="rounded-2xl shadow-md shrink-0"
          />
          <h1 className="text-3xl font-semibold tracking-tight leading-tight">
            Discover your next food adventure.
          </h1>
        </div>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          Hidden food gems tailored to your taste, goals, and mood — from cozy late-night
          bites to your next high-protein bowl.
        </p>

        <div className="mt-7 space-y-3">
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
