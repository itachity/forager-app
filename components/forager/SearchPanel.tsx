"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/forager/ToastProvider";
import { chat } from "@/lib/forager-api";
import { persistProfile } from "@/lib/forager-profile";
import { useT } from "@/lib/forager-i18n-context";
import type { GeoLocation, ProfileMode, UserProfile } from "@/lib/forager-types";
import { cn } from "@/lib/utils";

export function SearchPanel({ profile: initialProfile }: { profile: UserProfile }) {
  const router = useRouter();
  const toast = useToast();
  const { t } = useT();
  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const cheatDay = profile.profileMode === "cheat_day";
  const baseMode: Exclude<ProfileMode, "cheat_day"> = profile.authUserId
    ? "normal"
    : "guest";

  const setCheatDay = async (v: boolean) => {
    const next: UserProfile = {
      ...profile,
      profileMode: v ? "cheat_day" : baseMode,
      updatedAt: new Date().toISOString(),
    };
    setProfile(next);
    await persistProfile(next);
  };

  const onFind = async () => {
    setBusy(true);
    try {
      const message = query.trim() || "find me something good to eat right now";
      const location = await tryGeolocation();
      const res = await chat({ message, profile, location });
      const data = res.data;
      if (!data) {
        toast.show(t("search.noResults"), "error");
        setBusy(false);
        return;
      }
      sessionStorage.setItem(
        "forager:lastChat",
        JSON.stringify({ data, demo: !res.ok || res.demo === true, ts: Date.now() })
      );
      router.push("/results");
    } catch (e) {
      console.error(e);
      toast.show(t("search.failed"), "error");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="forager-card flex items-center gap-2 px-4 py-3">
        <Search className="h-5 w-5 text-muted-foreground shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (!busy) void onFind();
            }
          }}
          placeholder={t("search.placeholder")}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <button
        type="button"
        onClick={() => setCheatDay(!cheatDay)}
        aria-pressed={cheatDay}
        className={cn(
          "forager-card w-full p-4 flex items-center justify-between transition text-left",
          cheatDay && "bg-accent-soft border-accent/40"
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-2xl shrink-0 transition",
              cheatDay
                ? "bg-accent text-accent-foreground"
                : "bg-primary-soft text-primary"
            )}
          >
            <Sparkles size={18} />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm">{t("search.cheatDay")}</div>
            <div className="text-xs text-muted-foreground">
              {cheatDay ? t("search.cheatDay.on") : t("search.cheatDay.off")}
            </div>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors",
            cheatDay ? "bg-accent" : "bg-muted"
          )}
          aria-hidden
        >
          <span
            className={cn(
              "h-5 w-5 rounded-full bg-card shadow transition-transform",
              cheatDay ? "translate-x-5" : "translate-x-0"
            )}
          />
        </span>
      </button>

      <Button
        variant="cta"
        size="xl"
        className="w-full"
        onClick={onFind}
        disabled={busy}
      >
        {busy ? t("search.busy") : t("search.cta")}
        <ChevronRight />
      </Button>
    </div>
  );
}

async function tryGeolocation(): Promise<GeoLocation | undefined> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return undefined;
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), 5000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        resolve(undefined);
      },
      { enableHighAccuracy: false, timeout: 4500, maximumAge: 60_000 }
    );
  });
}
