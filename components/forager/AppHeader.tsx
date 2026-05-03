"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ForagerLogo } from "./ForagerLogo";
import { ProfileButton } from "./ProfileButton";
import { cn } from "@/lib/utils";

/**
 * Standard top header for app screens. Logo (or back arrow + logo) on the left,
 * profile button on the right.
 */
export function AppHeader({
  backHref,
  showProfile = true,
  className,
}: {
  /** If provided, shows a back arrow that links to this href. */
  backHref?: string;
  showProfile?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "px-5 pt-4 pb-3 sticky top-0 z-10 bg-background/95 backdrop-blur",
        className
      )}
    >
      <div className="max-w-xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          {backHref && (
            <Link
              href={backHref}
              aria-label="Back"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground hover:bg-muted transition"
            >
              <ArrowLeft size={18} />
            </Link>
          )}
          <ForagerLogo size="sm" />
        </div>
        {showProfile ? <ProfileButton /> : <div className="w-10" />}
      </div>
    </div>
  );
}
