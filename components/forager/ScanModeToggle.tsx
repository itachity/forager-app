"use client";

import Link from "next/link";
import { Camera, Languages } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "food" | "menu";

export function ScanModeToggle({ active }: { active: Mode }) {
  return (
    <div className="forager-card p-1 inline-flex w-full max-w-sm mx-auto">
      <ModeButton href="/scan/food" active={active === "food"} label="Snap meal" Icon={Camera} />
      <ModeButton href="/scan/menu" active={active === "menu"} label="Translate menu" Icon={Languages} />
    </div>
  );
}

function ModeButton({
  href,
  active,
  label,
  Icon,
}: {
  href: string;
  active: boolean;
  label: string;
  Icon: typeof Camera;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex-1 flex items-center justify-center gap-1.5 rounded-2xl px-3 py-2 text-sm font-semibold transition",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon size={16} />
      {label}
    </Link>
  );
}
