"use client";

import Link from "next/link";
import { ArrowLeft, Globe } from "lucide-react";
import { ForagerLogo } from "./ForagerLogo";
import { ProfileButton } from "./ProfileButton";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/forager-i18n-context";
import { LANGUAGE_LABELS } from "@/lib/forager-mappings";
import type { LanguageCode } from "@/lib/forager-types";

/**
 * Standard top header for app screens. Logo (or back arrow + logo) on the left,
 * profile button on the right.
 */
export function AppHeader({
  backHref,
  showProfile = true,
  showLanguageSwitcher = true,
  className,
}: {
  /** If provided, shows a back arrow that links to this href. */
  backHref?: string;
  showProfile?: boolean;
  showLanguageSwitcher?: boolean;
  className?: string;
}) {
  const { t, lang, setLang } = useT();
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
              aria-label={t("header.back")}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground hover:bg-muted transition"
            >
              <ArrowLeft size={18} />
            </Link>
          )}
          <ForagerLogo size="sm" />
        </div>
        <div className="flex items-center gap-2">
          {showLanguageSwitcher && (
            <label className="relative inline-flex items-center gap-1.5 h-9 pl-3 pr-2 rounded-full bg-secondary text-xs font-medium text-foreground hover:bg-muted transition cursor-pointer">
              <Globe size={14} aria-hidden />
              <span aria-hidden>{lang.toUpperCase()}</span>
              <span className="sr-only">{t("header.languageLabel")}</span>
              <select
                aria-label={t("header.languageLabel")}
                value={lang}
                onChange={(e) => setLang(e.target.value as LanguageCode)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              >
                {LANGUAGE_LABELS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {showProfile ? <ProfileButton /> : <div className="w-10" />}
        </div>
      </div>
    </div>
  );
}
