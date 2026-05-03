"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfidenceBadge, type ConfidenceLevel } from "./ConfidenceBadge";
import { MacroRangeBadge } from "./MacroRangeBadge";
import { AllergenFlag, intersectAllergens } from "./AllergenFlag";
import { SafetyNote } from "./SafetyNote";
import { Pill } from "./Pill";
import { useToast } from "./ToastProvider";
import { analyzeFood } from "@/lib/forager-api";
import { useT } from "@/lib/forager-i18n-context";
import type { AnalyzeFoodResponse, UserProfile } from "@/lib/forager-types";

export function ScanFoodResult({
  initial,
  profile,
  previewUrl,
}: {
  initial: AnalyzeFoodResponse;
  profile: UserProfile;
  previewUrl?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const { t } = useT();
  const [data, setData] = useState(initial);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [refining, setRefining] = useState(false);

  const flags = intersectAllergens(profile.dietary.allergens, data.ingredients);
  const matchPct = Math.round(data.confidence * 100);
  const macroLevel: ConfidenceLevel =
    data.confidence >= 0.8 ? "high" : data.confidence >= 0.55 ? "medium" : "low";

  const onRefine = async () => {
    if (Object.keys(answers).length === 0) return;
    setRefining(true);
    try {
      // We don't have the original file here — re-derive a Blob from the previewUrl.
      const blob = previewUrl ? await dataUrlToFile(previewUrl, "meal.jpg") : undefined;
      if (!blob) {
        toast.show(t("foodResult.toast.tryAnother"), "default");
        setRefining(false);
        return;
      }
      const res = await analyzeFood(blob, profile, answers);
      if (res.data) {
        setData(res.data);
        toast.show(t("foodResult.toast.refined"), "success");
      } else {
        toast.show(t("foodResult.toast.couldnt"), "error");
      }
    } finally {
      setRefining(false);
    }
  };

  const onLog = () => {
    if (profile.privacy.saveMealHistory) {
      // Stub: real impl would write to a meal_history table
      console.log("[forager] log meal", { dish: data.dish, ts: Date.now() });
      toast.show(t("foodResult.toast.logged"), "success");
    } else {
      toast.show(t("foodResult.toast.historyOff"), "default");
    }
  };

  return (
    <main className="min-h-screen pb-32">
      <div className="max-w-xl mx-auto px-5 pt-4 space-y-4">
        <div className="forager-card overflow-hidden">
          {previewUrl && (
            <div className="aspect-[4/3] bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt={data.dish} className="h-full w-full object-cover" />
            </div>
          )}
          <div className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="rounded-full bg-accent-soft text-accent px-2.5 py-1 text-xs font-bold">
                {matchPct}% {t("foodResult.matchSuffix")}
              </span>
              {data.cuisine && (
                <span className="text-xs text-muted-foreground">{data.cuisine}</span>
              )}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{data.dish}</h1>

            {data.ingredients.length > 0 && (
              <>
                <h3 className="mt-5 mb-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  {t("foodResult.likelyIngredients")}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {data.ingredients.map((i) => (
                    <span key={i} className="pill" data-selected="false">
                      {i}
                    </span>
                  ))}
                </div>
              </>
            )}

            {flags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {flags.map((a) => (
                  <AllergenFlag key={a} allergen={a} />
                ))}
              </div>
            )}
          </div>
        </div>

        {data.followUpQuestions.length > 0 && data.confidence < 0.85 && (
          <div className="forager-card p-5">
            <h2 className="text-base font-semibold">{t("foodResult.followup.heading")}</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {t("foodResult.followup.note")}
            </p>
            <div className="mt-4 space-y-4">
              {data.followUpQuestions.map((q) => (
                <div key={q.id}>
                  <p className="text-sm font-medium mb-2">{q.question}</p>
                  <div className="flex flex-wrap gap-2">
                    {q.options.map((opt) => (
                      <Pill
                        key={opt}
                        selected={answers[q.id] === opt}
                        onClick={() => setAnswers({ ...answers, [q.id]: opt })}
                      >
                        {opt}
                      </Pill>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <Button
              variant="cta"
              size="lg"
              className="mt-4 w-full"
              onClick={onRefine}
              disabled={refining || Object.keys(answers).length === 0}
            >
              <Sparkles /> {refining ? t("foodResult.refining") : t("foodResult.refine")}
            </Button>
          </div>
        )}

        <div className="forager-card p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h2 className="text-base font-semibold">{t("foodResult.estimatedMacros")}</h2>
            <ConfidenceBadge level={macroLevel} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MacroRangeBadge
              label={t("macros.calories")}
              range={{ min: data.macros.caloriesMin, max: data.macros.caloriesMax }}
              unit="kcal"
            />
            <MacroRangeBadge
              label={t("macros.protein")}
              range={{ min: data.macros.proteinMinG, max: data.macros.proteinMaxG }}
              unit="g"
            />
            <MacroRangeBadge
              label={t("macros.carbs")}
              range={{ min: data.macros.carbsMinG, max: data.macros.carbsMaxG }}
              unit="g"
            />
            <MacroRangeBadge
              label={t("macros.fat")}
              range={{ min: data.macros.fatMinG, max: data.macros.fatMaxG }}
              unit="g"
            />
          </div>
          {data.macros.servingNote && (
            <p className="text-xs text-muted-foreground mt-3">{data.macros.servingNote}</p>
          )}
        </div>

        {data.logSuggestions.length > 0 && (
          <div className="forager-card p-5">
            <h2 className="text-base font-semibold mb-3">{t("foodResult.howToLog")}</h2>
            <ul className="space-y-2">
              {data.logSuggestions.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <Check size={16} className="text-primary mt-0.5 shrink-0" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.nextOrderTips.length > 0 && (
          <div className="forager-card p-5">
            <h2 className="text-base font-semibold mb-3">{t("foodResult.tweakNext")}</h2>
            <ul className="space-y-2">
              {data.nextOrderTips.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <Sparkles size={16} className="text-accent mt-0.5 shrink-0" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <SafetyNote>{t("foodResult.safety")}</SafetyNote>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 px-5 pb-5 pt-4 bg-gradient-to-t from-background via-background/95 to-background/0">
        <div className="max-w-xl mx-auto grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            size="xl"
            className="rounded-2xl"
            onClick={() => router.push("/scan/food")}
          >
            <RotateCcw /> {t("foodResult.tryAnother")}
          </Button>
          <Button variant="cta" size="xl" onClick={onLog}>
            <Check /> {t("foodResult.logMeal")}
          </Button>
        </div>
      </div>
    </main>
  );
}

async function dataUrlToFile(dataUrl: string, name: string): Promise<File | null> {
  try {
    const r = await fetch(dataUrl);
    const blob = await r.blob();
    return new File([blob], name, { type: blob.type });
  } catch (e) {
    console.warn("[forager] dataUrlToFile failed", e);
    return null;
  }
}
