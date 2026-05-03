"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Search, ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/forager-i18n-context";
import type { I18nKey } from "@/lib/forager-i18n";

const items: { href: string; labelKey: I18nKey; Icon: typeof Compass; matches: (p: string) => boolean }[] = [
  { href: "/discover", labelKey: "nav.discover", Icon: Compass, matches: (p) => p.startsWith("/discover") },
  { href: "/home", labelKey: "nav.search", Icon: Search, matches: (p) => p === "/home" || p.startsWith("/results") },
  { href: "/scan/food", labelKey: "nav.scan", Icon: ScanLine, matches: (p) => p.startsWith("/scan") },
];

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useT();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-background/95 backdrop-blur border-t border-border/60 px-2 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-xl items-center justify-around">
        {items.map(({ href, labelKey, Icon, matches }) => {
          const active = matches(pathname ?? "");
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 min-w-16"
              aria-current={active ? "page" : undefined}
            >
              <Icon
                size={22}
                className={cn(active ? "text-accent" : "text-muted-foreground")}
                strokeWidth={active ? 2.4 : 2}
              />
              <span
                className={cn(
                  "text-[11px]",
                  active ? "text-accent font-semibold" : "text-muted-foreground"
                )}
              >
                {t(labelKey)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
