"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ForagerLogo } from "./ForagerLogo";

export function ScanHeader({ backHref = "/home" }: { backHref?: string }) {
  return (
    <div className="px-5 pt-4 pb-3 sticky top-0 z-10 bg-background/95 backdrop-blur">
      <div className="flex items-center justify-between">
        <Link
          href={backHref}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground hover:bg-muted transition"
        >
          <ArrowLeft size={18} />
        </Link>
        <ForagerLogo size="sm" />
        <div className="w-9" />
      </div>
    </div>
  );
}
