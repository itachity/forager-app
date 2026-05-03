"use client";

import type { ReactNode } from "react";
import type { UserProfile } from "@/lib/forager-types";
import { EyebrowLabel } from "@/components/forager/EyebrowLabel";
import { cn } from "@/lib/utils";

export type StepProps = {
  profile: UserProfile;
  update: (patch: Partial<UserProfile>) => void;
};

export function StepHeader({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-6", className)}>
      {eyebrow && <EyebrowLabel className="mb-3">{eyebrow}</EyebrowLabel>}
      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{title}</h1>
      {description && (
        <p className="text-muted-foreground mt-2 leading-relaxed">{description}</p>
      )}
    </div>
  );
}

export function ToggleRow({
  label,
  description,
  checked,
  onChange,
  variant = "primary",
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  variant?: "primary" | "accent";
}) {
  const onColor = variant === "accent" ? "bg-accent" : "bg-primary";
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-3 rounded-2xl bg-secondary/60 hover:bg-secondary p-4 text-left transition"
    >
      <div className="min-w-0">
        <div className="font-medium text-foreground">{label}</div>
        {description && (
          <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
        )}
      </div>
      <span
        className={cn(
          "inline-flex h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors",
          checked ? onColor : "bg-muted"
        )}
        aria-hidden
      >
        <span
          className={cn(
            "h-5 w-5 rounded-full bg-card shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0"
          )}
        />
      </span>
    </button>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  placeholder,
  suffix,
}: {
  label: string;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  placeholder?: string;
  suffix?: string;
}) {
  return (
    <label className="block">
      <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">
        {label}
      </div>
      <div className="flex items-center gap-2 rounded-2xl bg-secondary/60 px-3 py-2 border border-transparent focus-within:border-ring">
        <input
          type="number"
          value={value ?? ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-sm"
          inputMode="numeric"
          min={0}
        />
        {suffix && (
          <span className="text-xs text-muted-foreground">{suffix}</span>
        )}
      </div>
    </label>
  );
}

export function StepBody({ children }: { children: ReactNode }) {
  return <div className="forager-card p-6 md:p-8 max-w-xl mx-auto w-full">{children}</div>;
}
