"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Copy,
  Globe,
  MessageCircle,
  RotateCcw,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AllergenFlag, intersectAllergens } from "./AllergenFlag";
import { SafetyNote } from "./SafetyNote";
import { useToast } from "./ToastProvider";
import { languageCodeFromDetectedLanguage, phrasesForProfile } from "@/lib/forager-phrases";
import { LANGUAGE_DISPLAY_NAME } from "@/lib/forager-mappings";
import type { AnalyzeMenuResponse, UserProfile } from "@/lib/forager-types";

function localOrderLine(language: string, dishName: string) {
  const normalized = language.trim().toLowerCase();
  if (normalized.includes("japanese") || normalized === "ja" || normalized === "jp") {
    return `これをお願いします：${dishName}`;
  }
  if (normalized.includes("chinese") || normalized === "zh") {
    return `请给我这个：${dishName}`;
  }
  if (normalized.includes("spanish") || normalized === "es") {
    return `Quisiera pedir esto: ${dishName}`;
  }
  if (normalized.includes("tagalog") || normalized === "tl") {
    return `Gusto ko po ito: ${dishName}`;
  }
  if (normalized.includes("russian") || normalized === "ru") {
    return `Можно мне это: ${dishName}`;
  }
  return `I'd like to order this: ${dishName}`;
}

export function ScanMenuResult({
  data,
  profile,
}: {
  data: AnalyzeMenuResponse;
  profile: UserProfile;
}) {
  const router = useRouter();
  const toast = useToast();
  const [allOpen, setAllOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const top = data.rankedItems.slice(0, 3);
  const rest = data.rankedItems.slice(3);
  const showCultural =
    profile.language.explainCulturalNorms && data.overallCulturalNorms.length > 0;

  const phrases = useMemo(
    () => {
      const phraseLanguage =
        languageCodeFromDetectedLanguage(data.detectedLanguage) ?? profile.language.preferredLanguage;

      return (
      phrasesForProfile({
        language: phraseLanguage,
        allergens: profile.dietary.allergens,
        vegetarian: profile.dietary.dietRules.vegetarian,
        vegan: profile.dietary.dietRules.vegan,
        glutenFree: profile.dietary.dietRules.glutenFree,
        dairyFree: profile.dietary.dietRules.dairyFree,
      })
      );
    },
    [data.detectedLanguage, profile]
  );

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1200);
    } catch {
      toast.show("Couldn't copy to clipboard.", "error");
    }
  };

  return (
    <main className="min-h-screen pb-32">
      <div className="max-w-xl mx-auto px-5 pt-4 space-y-4">
        <div className="forager-card p-5">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            <Globe size={12} /> {data.detectedLanguage}
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            {data.cuisine} menu
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Translating into {LANGUAGE_DISPLAY_NAME[profile.language.preferredLanguage] ?? "English"}.
          </p>
        </div>

        {showCultural && (
          <div className="forager-card p-5 bg-primary-soft/40">
            <div className="flex items-center gap-2 mb-2 text-primary">
              <BookOpen size={16} />
              <h2 className="text-xs font-semibold uppercase tracking-wider">
                Local etiquette
              </h2>
            </div>
            <ul className="space-y-1.5 text-sm">
              {data.overallCulturalNorms.map((n, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-primary">•</span> {n}
                </li>
              ))}
            </ul>
          </div>
        )}

        <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold pl-1">
          Top picks for you
        </h2>
        <div className="space-y-3">
          {top.map((item, idx) => {
            const flags = intersectAllergens(profile.dietary.allergens, item.ingredients ?? []);
            return (
              <div key={`${item.translatedName}-${idx}`} className="forager-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                        {idx + 1}
                      </span>
                      <p className="font-semibold truncate">{item.translatedName}</p>
                    </div>
                    {item.originalName && (
                      <p className="text-xs text-muted-foreground italic mt-1">
                        {item.originalName}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-accent shrink-0">
                    <Star size={12} fill="currentColor" />
                    <span className="text-xs font-bold">
                      {(Math.round(item.matchScore * 10) / 10).toFixed(1)}
                    </span>
                  </div>
                </div>

                {item.description && (
                  <p className="text-sm text-muted-foreground mt-3">{item.description}</p>
                )}

                {flags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {flags.map((a) => (
                      <AllergenFlag key={a} allergen={a} />
                    ))}
                  </div>
                )}

                {item.whyRanked && (
                  <div className="mt-3 rounded-2xl bg-primary-soft/60 p-3">
                    <p className="text-[11px] uppercase tracking-wider text-primary font-semibold">
                      Why it fits
                    </p>
                    <p className="text-sm mt-1">{item.whyRanked}</p>
                  </div>
                )}

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-muted/40 p-2.5">
                    <p className="uppercase tracking-wider text-muted-foreground">Calories</p>
                    <p className="mt-1 font-semibold">{item.estimatedMacros?.calories ?? "Est. unavailable"}</p>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-2.5">
                    <p className="uppercase tracking-wider text-muted-foreground">Protein</p>
                    <p className="mt-1 font-semibold">{item.estimatedMacros?.protein ?? "Est. unavailable"}</p>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-2.5">
                    <p className="uppercase tracking-wider text-muted-foreground">Carbs</p>
                    <p className="mt-1 font-semibold">{item.estimatedMacros?.carbs ?? "Est. unavailable"}</p>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-2.5">
                    <p className="uppercase tracking-wider text-muted-foreground">Fat</p>
                    <p className="mt-1 font-semibold">{item.estimatedMacros?.fat ?? "Est. unavailable"}</p>
                  </div>
                </div>

                {item.phraseToOrder && (
                  <div className="mt-2 flex gap-2 rounded-2xl bg-accent-soft p-3">
                    <MessageCircle size={16} className="text-accent mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-accent font-semibold">
                        Say to the server
                      </p>
                      <p className="text-sm mt-1 font-medium">&ldquo;{item.phraseToOrder}&rdquo;</p>
                      {item.originalName && (
                        <p className="text-xs mt-1 text-muted-foreground">
                          {localOrderLine(data.detectedLanguage, item.originalName)}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {rest.length > 0 && (
          <div className="forager-card p-4">
            <button
              type="button"
              className="w-full flex items-center justify-between"
              onClick={() => setAllOpen((v) => !v)}
            >
              <span className="text-sm font-semibold">
                {allOpen ? "Hide" : `Show all ${data.rankedItems.length} dishes`}
              </span>
              {allOpen ? (
                <ChevronUp size={18} className="text-muted-foreground" />
              ) : (
                <ChevronDown size={18} className="text-muted-foreground" />
              )}
            </button>

            {allOpen && (
              <ul className="mt-3 divide-y divide-border/60">
                {data.rankedItems.map((item, idx) => {
                  const flags = intersectAllergens(profile.dietary.allergens, item.ingredients ?? []);
                  return (
                    <li key={`all-${idx}`} className="py-2 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-5 shrink-0">
                        {idx + 1}.
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {item.translatedName}
                        </p>
                        {item.originalName && (
                          <p className="text-[11px] text-muted-foreground italic truncate">
                            {item.originalName}
                          </p>
                        )}
                      </div>
                      {flags.map((a) => (
                        <AllergenFlag key={a} allergen={a} className="shrink-0" />
                      ))}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        <div className="forager-card p-5">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
            Phrases to say
          </h2>
          <ul className="divide-y divide-border/60">
            {phrases.map((p, i) => {
              const id = `phrase-${i}`;
              return (
                <li key={id} className="py-3">
                  <div className="text-xs text-muted-foreground">{p.en}</div>
                  <div className="text-base font-medium mt-1">{p.local}</div>
                  {p.phonetic && p.phonetic !== p.local && (
                    <div className="text-xs text-muted-foreground mt-0.5">{p.phonetic}</div>
                  )}
                  <button
                    type="button"
                    onClick={() => copy(id, p.local)}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    <Copy size={12} />
                    {copiedId === id ? "Copied" : "Copy"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <SafetyNote>
          Forager can flag possible risks, but verify allergens and preparation with the restaurant.
        </SafetyNote>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 px-5 pb-5 pt-4 bg-gradient-to-t from-background via-background/95 to-background/0">
        <div className="max-w-xl mx-auto">
          <Button
            variant="outline"
            size="xl"
            className="w-full rounded-2xl"
            onClick={() => router.push("/scan/menu")}
          >
            <RotateCcw /> Try another menu
          </Button>
        </div>
      </div>
    </main>
  );
}
