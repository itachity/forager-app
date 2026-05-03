"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadProfileLocal } from "@/lib/forager-profile";
import type { UserProfile } from "@/lib/forager-types";
import { cn } from "@/lib/utils";

export function ProfileButton({ className }: { className?: string }) {
  const [profile, setProfile] = useState<UserProfile | null>(() =>
    typeof window === "undefined" ? null : loadProfileLocal()
  );

  // Re-read on mount in case profile changed in another tab.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = () => setProfile(loadProfileLocal());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const initial = profileInitial(profile);

  return (
    <Link
      href="/profile"
      aria-label="Open profile"
      className={cn(
        "relative flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold shadow-sm hover:opacity-90 transition",
        className
      )}
    >
      {initial}
      {profile?.profileMode === "cheat_day" && (
        <span
          className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-accent border-2 border-background"
          aria-hidden
        />
      )}
    </Link>
  );
}

function profileInitial(p: UserProfile | null): string {
  if (!p) return "F";
  const name = p.displayName || p.email || "";
  const ch = name.trim()[0];
  if (ch) return ch.toUpperCase();
  return p.profileMode === "guest" ? "G" : "F";
}
