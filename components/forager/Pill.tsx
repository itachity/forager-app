"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Props = {
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
};

export function Pill({ selected, onClick, children, className, type = "button", disabled }: Props) {
  return (
    <button
      type={type}
      onClick={onClick}
      data-selected={selected ? "true" : "false"}
      disabled={disabled}
      className={cn("pill", className)}
    >
      {children}
    </button>
  );
}
