"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import type { TodayHours } from "@/lib/forager-types";
import { cn } from "@/lib/utils";

function parseTimeToToday(label: string | null): Date | null {
  if (!label) return null;
  const match = label.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const meridian = match[3].toUpperCase();
  if (meridian === "PM" && hour < 12) hour += 12;
  if (meridian === "AM" && hour === 12) hour = 0;
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

function describe(hours: TodayHours, now: Date): { tone: "open" | "closed" | "neutral"; text: string } {
  if (hours.is_24h) {
    return { tone: "open", text: "Open 24 hours today" };
  }
  if (hours.is_closed_today) {
    return { tone: "closed", text: `Closed ${hours.day}` };
  }

  if (hours.open_now && hours.closes_at) {
    const closeAt = parseTimeToToday(hours.closes_at);
    if (closeAt) {
      const minutesUntilClose = Math.round((closeAt.getTime() - now.getTime()) / 60000);
      if (minutesUntilClose > 0 && minutesUntilClose <= 60) {
        return { tone: "closed", text: `Closes in ${minutesUntilClose} min (${hours.closes_at})` };
      }
    }
    return { tone: "open", text: `Open · closes ${hours.closes_at}` };
  }

  if (!hours.open_now && hours.open) {
    return { tone: "closed", text: `Closed · opens ${hours.open}` };
  }

  return { tone: "neutral", text: "Hours unavailable" };
}

export function TimeCard({ hours }: { hours: TodayHours }) {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const { tone, text } = describe(hours, now);

  return (
    <div
      className={cn(
        "mt-3 flex items-center gap-2 rounded-2xl px-3 py-2 text-xs",
        tone === "open" && "bg-emerald-50 text-emerald-700",
        tone === "closed" && "bg-amber-50 text-amber-700",
        tone === "neutral" && "bg-muted text-muted-foreground"
      )}
    >
      <Clock size={13} className="shrink-0" />
      <span className="font-medium">{text}</span>
      {hours.timezone && (
        <span className="ml-auto text-[10px] text-muted-foreground">{hours.timezone}</span>
      )}
    </div>
  );
}
