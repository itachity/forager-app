"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, ChevronUp, DollarSign, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/forager/Pill";
import { useToast } from "@/components/forager/ToastProvider";
import { chat } from "@/lib/forager-api";
import type { GeoLocation, UserProfile } from "@/lib/forager-types";
import { cn } from "@/lib/utils";

const QUICK_FILTERS = [
  "Nearest",
  "Top-Rated",
  "Late-Night",
  "Solo Dining",
  "Cheap",
  "High Protein",
  "Non-Spicy",
];

const TASTE_FILTERS = ["Non-Spicy", "Mild", "Spicy", "Sweet", "Savory", "Sour"];

const DIETARY_FILTERS = [
  "Low-Calorie",
  "High-Protein",
  "Vegan",
  "Vegetarian",
  "Gluten-Free",
  "Keto",
];

export function SearchPanel({ profile }: { profile: UserProfile }) {
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [activeQuick, setActiveQuick] = useState<string[]>(["Nearest"]);
  const [price, setPrice] = useState(29);
  const [diet, setDiet] = useState<string[]>([]);
  const [taste, setTaste] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [busy, setBusy] = useState(false);

  const toggle = (arr: string[], v: string, set: (a: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const onFind = async () => {
    setBusy(true);
    try {
      const message = composeMessage({ query, quick: activeQuick, diet, taste, price });
      const location = await tryGeolocation();
      const res = await chat({ message, profile, location });
      const data = res.data;
      if (!data) {
        toast.show("No results — try widening your filters.", "error");
        setBusy(false);
        return;
      }
      sessionStorage.setItem(
        "forager:lastChat",
        JSON.stringify({ data, demo: !res.ok || res.demo === true, ts: Date.now() })
      );
      router.push("/results");
    } catch (e) {
      console.error(e);
      toast.show("Search failed. Showing demo results.", "error");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="forager-card flex items-center gap-2 px-4 py-3">
        <Search className="h-5 w-5 text-muted-foreground shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for food... (e.g., high protein low calorie)"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {QUICK_FILTERS.map((f) => (
          <Pill
            key={f}
            selected={activeQuick.includes(f)}
            onClick={() => toggle(activeQuick, f, setActiveQuick)}
          >
            {f}
          </Pill>
        ))}
      </div>

      <div className="forager-card p-5">
        <button
          type="button"
          className="w-full flex items-center justify-between"
          onClick={() => setFiltersOpen((v) => !v)}
        >
          <h2 className="text-base font-semibold text-primary">Filters</h2>
          {filtersOpen ? (
            <ChevronUp size={18} className="text-muted-foreground" />
          ) : (
            <ChevronDown size={18} className="text-muted-foreground" />
          )}
        </button>

        {filtersOpen && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Price range</span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              step={1}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="w-full accent-[var(--primary)]"
              aria-label="Max price"
            />
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <span>$10</span>
              <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                Under ${price}
              </span>
              <span>$100</span>
            </div>

            <h3 className="mt-6 mb-3 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Dietary preferences
            </h3>
            <div className="flex flex-wrap gap-2">
              {DIETARY_FILTERS.map((d) => (
                <Pill
                  key={d}
                  selected={diet.includes(d)}
                  onClick={() => toggle(diet, d, setDiet)}
                >
                  {d}
                </Pill>
              ))}
            </div>

            <h3 className="mt-6 mb-3 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Taste preferences
            </h3>
            <div className="flex flex-wrap gap-2">
              {TASTE_FILTERS.map((t) => (
                <Pill
                  key={t}
                  selected={taste.includes(t)}
                  onClick={() => toggle(taste, t, setTaste)}
                >
                  {t}
                </Pill>
              ))}
            </div>
          </div>
        )}
      </div>

      <Button
        variant="cta"
        size="xl"
        className={cn("w-full")}
        onClick={onFind}
        disabled={busy}
      >
        {busy ? "Foraging…" : "Find My Perfect Meal"}
        <ChevronRight />
      </Button>
    </div>
  );
}

function composeMessage(opts: {
  query: string;
  quick: string[];
  diet: string[];
  taste: string[];
  price: number;
}): string {
  const parts: string[] = [];
  if (opts.query) parts.push(opts.query);
  if (opts.quick.length) parts.push(opts.quick.join(", ").toLowerCase());
  if (opts.diet.length) parts.push(opts.diet.join(", ").toLowerCase());
  if (opts.taste.length) parts.push(opts.taste.join(", ").toLowerCase());
  parts.push(`under $${opts.price}`);
  return parts.join(", ");
}

async function tryGeolocation(): Promise<GeoLocation | undefined> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return undefined;
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), 5000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        clearTimeout(timer);
        resolve(undefined);
      },
      { enableHighAccuracy: false, timeout: 4500, maximumAge: 60_000 }
    );
  });
}
