"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  LogOut,
  Pencil,
  Shield,
  Sparkles,
  Target,
  Languages,
  SlidersHorizontal,
  Utensils,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/forager/AppHeader";
import { BottomNav } from "@/components/forager/BottomNav";
import { useToast } from "@/components/forager/ToastProvider";
import {
  activeDietRules,
  budgetLabelOf,
  goalLabelOf,
  languageLabelOf,
  spiceLabelOf,
} from "@/lib/forager-mappings";
import { loadProfileLocal, persistProfile } from "@/lib/forager-profile";
import { signOut } from "@/lib/forager-supabase";
import type { UserProfile } from "@/lib/forager-types";
import { cn } from "@/lib/utils";

export default function ProfilePage() {
  const router = useRouter();
  const toast = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(() =>
    typeof window === "undefined" ? null : loadProfileLocal()
  );

  useEffect(() => {
    if (typeof window !== "undefined" && !profile) {
      router.replace("/");
    }
  }, [profile, router]);

  if (!profile) {
    return (
      <main className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </main>
    );
  }

  const initial = (profile.displayName || profile.email || "F").trim()[0]?.toUpperCase() ?? "F";
  const shortId = profile.id.slice(0, 6);
  const cheatDay = profile.profileMode === "cheat_day";

  const setCheatDay = async (v: boolean) => {
    const next: UserProfile = {
      ...profile,
      profileMode: v ? "cheat_day" : profile.authUserId ? "normal" : "guest",
      updatedAt: new Date().toISOString(),
    };
    setProfile(next);
    await persistProfile(next);
    toast.show(v ? "Cheat day on — preferences ignored." : "Profile preferences re-engaged.", "success");
  };

  const onSignOut = async () => {
    await signOut();
    toast.show("Signed out.", "success");
    router.push("/");
  };

  const sections: { icon: typeof Utensils; title: string; sub: string; href: string }[] = [
    {
      icon: Utensils,
      title: "Dietary & spice tolerance",
      sub: dietSubLine(profile),
      href: "/onboarding",
    },
    {
      icon: SlidersHorizontal,
      title: "Preferences",
      sub: prefsSubLine(profile),
      href: "/onboarding",
    },
    {
      icon: Target,
      title: "Nutrition goals",
      sub: goalLabelOf(profile.nutritionGoals.goalType),
      href: "/onboarding",
    },
    {
      icon: Languages,
      title: "Language",
      sub: `${languageLabelOf(profile.language.preferredLanguage)} · ${profile.language.explainCulturalNorms ? "cultural norms on" : "cultural norms off"}`,
      href: "/onboarding",
    },
    {
      icon: Shield,
      title: "Privacy",
      sub: privacySubLine(profile),
      href: "/onboarding",
    },
  ];

  return (
    <main className="min-h-screen pb-32">
      <AppHeader showProfile={false} />
      <div className="max-w-xl mx-auto px-5 pt-2 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">My Profile</h1>
          <button
            type="button"
            onClick={() => setCheatDay(!cheatDay)}
            aria-label={cheatDay ? "Turn off cheat day" : "Turn on cheat day"}
            className={cn(
              "relative flex h-10 w-10 items-center justify-center rounded-full transition",
              cheatDay ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground"
            )}
          >
            <Sparkles size={18} />
            {cheatDay && (
              <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-accent border-2 border-background" />
            )}
          </button>
        </div>

        <div className="forager-card p-4 flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary text-xl font-bold">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold truncate">
                {profile.displayName || profile.email || "Guest forager"}
              </p>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                  cheatDay
                    ? "bg-accent-soft text-accent"
                    : profile.profileMode === "guest"
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary-soft text-primary"
                )}
              >
                {cheatDay ? "Cheat" : profile.profileMode === "guest" ? "Guest" : "Normal"}
              </span>
            </div>
            {profile.email && (
              <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
            )}
            <p className="text-[11px] text-muted-foreground mt-0.5">User ID · forager_{shortId}</p>
          </div>
          <Link
            href="/onboarding"
            aria-label="Edit profile"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground hover:bg-muted transition"
          >
            <Pencil size={16} />
          </Link>
        </div>

        <div className="forager-card divide-y divide-border/60">
          {sections.map(({ icon: Icon, title, sub, href }) => (
            <Link
              key={title}
              href={href}
              className="flex items-center gap-3 p-4 hover:bg-muted/30 transition first:rounded-t-3xl last:rounded-b-3xl"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-soft text-primary shrink-0">
                <Icon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm">{title}</div>
                <div className="text-xs text-muted-foreground truncate">{sub}</div>
              </div>
              <ChevronRight size={16} className="text-muted-foreground shrink-0" />
            </Link>
          ))}
        </div>

        <div className="pt-2 flex justify-center">
          <Button variant="ghost" className="text-muted-foreground" onClick={onSignOut}>
            <LogOut size={16} /> Sign out
          </Button>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}

function dietSubLine(p: UserProfile): string {
  const rules = activeDietRules(p.dietary.dietRules);
  const parts: string[] = [];
  if (rules.length) parts.push(rules.join(", "));
  if (p.dietary.allergens.length) parts.push(`avoids ${p.dietary.allergens.join(", ")}`);
  parts.push(`${spiceLabelOf(p.dietary.spiceTolerance)} spice`);
  return parts.join(" · ");
}

function prefsSubLine(p: UserProfile): string {
  return `${budgetLabelOf(p.preferences.budget)} · ${p.preferences.maxDistanceMiles} mi · ${p.preferences.likedCuisines.length || "any"} cuisines`;
}

function privacySubLine(p: UserProfile): string {
  const on: string[] = [];
  if (p.privacy.saveLocationHistory) on.push("location");
  if (p.privacy.saveMealHistory) on.push("meals");
  if (p.privacy.useProfileForRecommendations) on.push("personalize");
  return on.length ? `Saving: ${on.join(", ")}` : "Nothing saved";
}
