"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Check, AlertTriangle, MinusCircle } from "lucide-react";
import type { ToolTraceEntry } from "@/lib/forager-types";
import { cn } from "@/lib/utils";

export function ToolTracePanel({ trace }: { trace?: ToolTraceEntry[] }) {
  const [open, setOpen] = useState(false);
  if (!trace || trace.length === 0) return null;

  return (
    <div className="forager-card p-5">
      <button
        type="button"
        className="w-full flex items-center justify-between"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            How Forager found these
          </div>
          <div className="text-sm font-semibold mt-1">
            {trace.length} tool calls
          </div>
        </div>
        {open ? (
          <ChevronUp size={18} className="text-muted-foreground" />
        ) : (
          <ChevronDown size={18} className="text-muted-foreground" />
        )}
      </button>

      {open && (
        <ol className="mt-4 relative border-l border-border/80 ml-2 space-y-3">
          {trace.map((t, idx) => (
            <li key={idx} className="pl-4 relative">
              <span
                className={cn(
                  "absolute -left-2 top-1 flex h-4 w-4 items-center justify-center rounded-full",
                  iconBg(t.status)
                )}
              >
                {iconFor(t.status)}
              </span>
              <div
                className={cn(
                  "text-sm font-medium",
                  t.status === "skipped" && "text-muted-foreground"
                )}
              >
                {prettyName(t.tool)}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {summary(t)}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function iconFor(status: string) {
  if (status === "ok") return <Check size={10} className="text-primary-foreground" strokeWidth={3} />;
  if (status === "error") return <AlertTriangle size={10} className="text-destructive-foreground" strokeWidth={3} />;
  return <MinusCircle size={10} className="text-muted-foreground" strokeWidth={2} />;
}

function iconBg(status: string) {
  if (status === "ok") return "bg-primary";
  if (status === "error") return "bg-destructive";
  return "bg-muted";
}

function prettyName(tool: string): string {
  return tool
    .replace(/^nvidia_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function summary(t: ToolTraceEntry): string {
  if (t.status === "skipped") return t.reason ?? "Skipped";
  if (t.status === "error") return t.error ?? "Error";
  if (typeof t.count === "number") return `${t.count} results${t.radius_meters ? ` within ${Math.round(t.radius_meters / 1000)} km` : ""}`;
  if (t.queries) return `Queries: ${t.queries.join(", ")}`;
  if (t.weights) {
    const numeric = Object.entries(t.weights)
      .map(([key, raw]) => {
        const value =
          typeof raw === "number" ? raw : parseFloat(String(raw).replace("%", ""));
        return [key, Number.isFinite(value) ? value : 0] as const;
      })
      .sort((a, b) => b[1] - a[1]);
    const top = numeric[0];
    if (top) {
      const pct = top[1] <= 1 ? Math.round(top[1] * 100) : Math.round(top[1]);
      return `Top weight: ${top[0]} (${pct}%)`;
    }
  }
  return "OK";
}
