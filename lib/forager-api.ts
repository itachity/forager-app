import type {
  AnalyzeFoodResponse,
  AnalyzeMenuResponse,
  ApiResult,
  ChatRecommendation,
  ChatRequest,
  ChatResponse,
  Confidence,
  GeoLocation,
  MenuItem,
  OrderSuggestion,
  TokenUsageSummary,
  ToolTraceEntry,
  UserProfile,
} from "./forager-types";
import { goalStringFromProfile, LANGUAGE_DISPLAY_NAME } from "./forager-mappings";
import { DEMO_CHAT, DEMO_FOOD_ANALYSIS, DEMO_MENU_ANALYSIS } from "./forager-fallback";
import { resizeImage } from "./forager-image";
import { phrasesForProfile } from "./forager-phrases";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function chat(
  req: { message: string; profile: UserProfile; location?: GeoLocation },
  signal?: AbortSignal
): Promise<ApiResult<ChatResponse>> {
  const payload: ChatRequest = {
    message: req.message,
    user_profile: req.profile,
    location: req.location,
  };
  try {
    const r = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });
    if (!r.ok) {
      const text = await safeText(r);
      console.warn("[forager] /chat non-2xx", r.status, text);
      return { ok: false, error: `Backend ${r.status}`, demo: true, data: DEMO_CHAT };
    }
    const raw = (await r.json()) as Record<string, unknown>;
    return { ok: true, data: normalizeChatResponse(raw) };
  } catch (e) {
    if ((e as Error).name === "AbortError") return { ok: false, error: "aborted" };
    console.warn("[forager] /chat failed; using demo", e);
    return { ok: false, error: (e as Error).message, demo: true, data: DEMO_CHAT };
  }
}

export async function analyzeFood(
  file: File,
  profile: UserProfile,
  clarifications?: Record<string, string>,
  recordTextOrSignal?: string | AbortSignal,
  maybeSignal?: AbortSignal
): Promise<ApiResult<AnalyzeFoodResponse>> {
  const recordText = typeof recordTextOrSignal === "string" ? recordTextOrSignal : "";
  const signal = typeof recordTextOrSignal === "string" ? maybeSignal : recordTextOrSignal;

  try {
    const blob = await resizeImage(file);
    const fd = new FormData();
    fd.append("file", blob, file.name || "meal.jpg");
    fd.append("profile", JSON.stringify(profile));
    fd.append("record_text", recordText);
    if (clarifications) fd.append("clarifications", JSON.stringify(clarifications));
    const r = await fetch(`${API_BASE}/analyze-food`, {
      method: "POST",
      body: fd,
      signal,
    });
    if (!r.ok) {
      console.warn("[forager] /analyze-food non-2xx", r.status, await safeText(r));
      return { ok: false, error: `Backend ${r.status}`, demo: true, data: DEMO_FOOD_ANALYSIS };
    }
    const raw = (await r.json()) as Record<string, unknown>;
    return { ok: true, data: normalizeFoodResponse(raw) };
  } catch (e) {
    if ((e as Error).name === "AbortError") return { ok: false, error: "aborted" };
    console.warn("[forager] /analyze-food failed; using demo", e);
    return { ok: false, error: (e as Error).message, demo: true, data: DEMO_FOOD_ANALYSIS };
  }
}

export async function analyzeMenu(
  file: File,
  profile: UserProfile,
  recordTextOrSignal?: string | AbortSignal,
  maybeSignal?: AbortSignal
): Promise<ApiResult<AnalyzeMenuResponse>> {
  const recordText = typeof recordTextOrSignal === "string" ? recordTextOrSignal : "";
  const signal = typeof recordTextOrSignal === "string" ? maybeSignal : recordTextOrSignal;

  try {
    const blob = await resizeImage(file);
    const fd = new FormData();
    fd.append("file", blob, file.name || "menu.jpg");
    fd.append("goal", goalStringFromProfile(profile));
    fd.append("profile", JSON.stringify(profile));
    fd.append("record_text", recordText);
    const r = await fetch(`${API_BASE}/analyze-menu`, {
      method: "POST",
      body: fd,
      signal,
    });
    if (!r.ok) {
      console.warn("[forager] /analyze-menu non-2xx", r.status, await safeText(r));
      return { ok: false, error: `Backend ${r.status}`, demo: true, data: DEMO_MENU_ANALYSIS };
    }
    const raw = (await r.json()) as Record<string, unknown>;
    return { ok: true, data: normalizeMenuResponse(raw, profile) };
  } catch (e) {
    if ((e as Error).name === "AbortError") return { ok: false, error: "aborted" };
    console.warn("[forager] /analyze-menu failed; using demo", e);
    return { ok: false, error: (e as Error).message, demo: true, data: DEMO_MENU_ANALYSIS };
  }
}

/* ---------- adapters ---------- */

function normalizeChatResponse(raw: Record<string, unknown>): ChatResponse {
  const recs = Array.isArray(raw.recommendations) ? (raw.recommendations as Record<string, unknown>[]) : [];
  const recommendations: ChatRecommendation[] = recs.slice(0, 3).map((r, idx) => {
    const macros = (r.estimated_macros as Record<string, unknown> | undefined) ?? undefined;
    const suggestions = normalizeOrderSuggestions(r.order_suggestions);
    const firstSuggestion = suggestions[0];
    const firstMacros = firstSuggestion?.estimated_macros;

    return {
      rank: numOr(r.rank, idx + 1),
      place: strOr(r.place, "Unknown"),
      address: strOr(r.address, ""),
      score: numOr(r.score, 0),
      order: strOr(r.order, firstSuggestion?.name ?? ""),
      order_suggestions: suggestions,
      calories: macros ? strOrUndefined(macros.calories) : firstMacros?.calories,
      protein: macros ? strOrUndefined(macros.protein) : firstMacros?.protein,
      carbs: macros ? strOrUndefined(macros.carbs) : firstMacros?.carbs,
      fat: macros ? strOrUndefined(macros.fat) : firstMacros?.fat,
      confidence: macros
        ? (macros.confidence as Confidence | undefined)
        : firstMacros?.confidence,
      why: strOr(r.why, ""),
      tradeoffs: strOrUndefined(r.tradeoffs),
      sources_used: Array.isArray(r.sources_used) ? (r.sources_used as string[]) : [],
      google_maps_url: strOrUndefined(r.google_maps_url),
      price: strOrUndefined(r.price) ?? priceLabelFromLevel(r.price_level ?? r.priceLevel),
      price_usd:
        typeof r.price_usd === "number" && Number.isFinite(r.price_usd)
          ? r.price_usd
          : undefined,
      review_quotes: Array.isArray(r.review_quotes)
        ? (r.review_quotes as string[]).slice(0, 2)
        : undefined,
    };
  });
  return {
    answer: strOr(raw.answer, ""),
    recommendations,
    tool_trace: Array.isArray(raw.tool_trace) ? (raw.tool_trace as ToolTraceEntry[]) : undefined,
    limitations: Array.isArray(raw.limitations) ? (raw.limitations as string[]) : undefined,
    token_usage: normalizeTokenUsage(raw.token_usage),
  };
}

function normalizeOrderSuggestions(value: unknown): OrderSuggestion[] {
  if (!Array.isArray(value)) return [];
  return (value as Record<string, unknown>[]).slice(0, 5).map((item) => {
    const macros = (item.estimated_macros as Record<string, unknown> | undefined) ?? {};
    return {
      name: strOr(item.name, ""),
      modifications: Array.isArray(item.modifications) ? (item.modifications as string[]) : [],
      estimated_macros: {
        calories: strOr(macros.calories, "unknown"),
        protein: strOr(macros.protein, "unknown"),
        carbs: strOr(macros.carbs, "unknown"),
        fat: strOr(macros.fat, "unknown"),
        confidence: normalizeConfidence(macros.confidence),
      },
      why: strOr(item.why, ""),
    };
  });
}

/** Maps Google Places `PRICE_LEVEL_*` strings or 0..4 ints to "$"/"$$"/etc. */
function priceLabelFromLevel(level: unknown): string | undefined {
  if (typeof level === "number") {
    if (level <= 0) return undefined;
    return "$".repeat(Math.min(level, 4));
  }
  if (typeof level === "string") {
    switch (level) {
      case "PRICE_LEVEL_FREE": return undefined;
      case "PRICE_LEVEL_INEXPENSIVE": return "$";
      case "PRICE_LEVEL_MODERATE": return "$$";
      case "PRICE_LEVEL_EXPENSIVE": return "$$$";
      case "PRICE_LEVEL_VERY_EXPENSIVE": return "$$$$";
      default: return undefined;
    }
  }
  return undefined;
}

function normalizeFoodResponse(raw: Record<string, unknown>): AnalyzeFoodResponse {
  const macros = (raw.macros as Record<string, unknown> | undefined) ?? {};
  return {
    status: strOrUndefined(raw.status),
    filename: strOrUndefined(raw.filename),
    dish: strOr(raw.dish, "Unknown dish"),
    confidence: numOr(raw.confidence, 0.5),
    cuisine: strOrUndefined(raw.cuisine) ?? null,
    detectedLanguage: strOrUndefined(raw.detectedLanguage),
    recordText: strOrUndefined(raw.recordText),
    record_text: strOrUndefined(raw.record_text),
    ingredients: Array.isArray(raw.ingredients) ? (raw.ingredients as string[]) : [],
    followUpQuestions: Array.isArray(raw.followUpQuestions)
      ? (raw.followUpQuestions as AnalyzeFoodResponse["followUpQuestions"])
      : [],
    macros: {
      caloriesMin: numOr(macros.caloriesMin, 0),
      caloriesMax: numOr(macros.caloriesMax, 0),
      proteinMinG: numOr(macros.proteinMinG, 0),
      proteinMaxG: numOr(macros.proteinMaxG, 0),
      carbsMinG: numOr(macros.carbsMinG, 0),
      carbsMaxG: numOr(macros.carbsMaxG, 0),
      fatMinG: numOr(macros.fatMinG, 0),
      fatMaxG: numOr(macros.fatMaxG, 0),
      servingNote: strOr(macros.servingNote, ""),
    },
    logSuggestions: Array.isArray(raw.logSuggestions) ? (raw.logSuggestions as string[]) : [],
    nextOrderTips: Array.isArray(raw.nextOrderTips) ? (raw.nextOrderTips as string[]) : [],
    structured_identification: raw.structured_identification,
    usda_references: Array.isArray(raw.usda_references) ? (raw.usda_references as unknown[]) : undefined,
    tools_used: Array.isArray(raw.tools_used) ? (raw.tools_used as string[]) : undefined,
    token_usage: normalizeTokenUsage(raw.token_usage),
  };
}

/** FastAPI returns:
 *   { status, structured_analysis: {detected_language, menu_context, ranked_candidates[]},
 *     final_recommendation: "<prose>", usda_references: [...] }
 * We map that to the cleaner reference shape and add a client-generated
 * `phraseToOrder` per item from the user's allergens.
 */
function normalizeMenuResponse(raw: Record<string, unknown>, profile: UserProfile): AnalyzeMenuResponse {
  const sa = (raw.structured_analysis as Record<string, unknown> | undefined) ?? {};
  const detLang = (sa.detected_language as Record<string, unknown> | undefined) ?? {};
  const ctx = (sa.menu_context as Record<string, unknown> | undefined) ?? {};
  const candidates = Array.isArray(sa.ranked_candidates)
    ? (sa.ranked_candidates as Record<string, unknown>[])
    : [];

  const rankedItems: MenuItem[] = candidates.map((c) => {
    const ingredients = Array.isArray(c.likely_ingredients) ? (c.likely_ingredients as string[]) : [];
    const translatedName = strOr(c.dish_english, strOr(c.dish_original, "Unknown dish"));
    return {
      originalName: strOr(c.dish_original, ""),
      translatedName,
      description: strOr(c.reason, ""),
      matchScore: clamp01to10(numOr(c.goal_fit_score, 50) / 10),
      whyRanked: strOr(c.reason, ""),
      culturalNote: undefined,
      phraseToOrder: phraseForDish(translatedName, profile),
      ingredients,
      category: strOrUndefined(c.category),
      goalFitScore: numOr(c.goal_fit_score, 0),
      riskFlags: {
        calorieRisk: strOrUndefined(c.calorie_risk),
        carbRisk: strOrUndefined(c.carb_risk),
        fatRisk: strOrUndefined(c.fat_risk),
      },
    };
  });

  const prose = strOrUndefined(raw.final_recommendation);
  const overallCulturalNorms = extractBullets(prose ?? "", 4);

  return {
    status: strOrUndefined(raw.status),
    detectedLanguage:
      strOrUndefined(detLang.name) ??
      LANGUAGE_DISPLAY_NAME[profile.language.preferredLanguage] ??
      "Unknown",
    cuisine: strOr(ctx.restaurant_type, "Restaurant"),
    overallCulturalNorms,
    rankedItems,
    prose,
    record_text: strOrUndefined(raw.record_text),
    profile_context: raw.profile_context,
    menu_description: strOrUndefined(raw.menu_description),
    structured_analysis: raw.structured_analysis,
    usda_references: Array.isArray(raw.usda_references) ? (raw.usda_references as unknown[]) : undefined,
    tools_used: Array.isArray(raw.tools_used) ? (raw.tools_used as string[]) : undefined,
    token_usage: normalizeTokenUsage(raw.token_usage),
  };
}

/** Generate a single, polite "I'd like X, please" line using the user's
 * preferred language and a generic ordering template. Best-effort — if the
 * dish name is in the source language, this still reads naturally. */
function phraseForDish(translatedName: string, profile: UserProfile): string {
  const phrases = phrasesForProfile({
    language: profile.language.preferredLanguage,
    allergens: profile.dietary.allergens,
    vegetarian: profile.dietary.dietRules.vegetarian,
    vegan: profile.dietary.dietRules.vegan,
    glutenFree: profile.dietary.dietRules.glutenFree,
    dairyFree: profile.dietary.dietRules.dairyFree,
  });
  const lead = phrases.find((p) => p.local.includes("allerg") || p.local.includes("ベジタリアン") || p.local.includes("素"));
  if (lead) return `"${translatedName}", please. ${lead.local}`;
  return `I'd like the ${translatedName}, please.`;
}

function extractBullets(text: string, max = 4): string[] {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  const bullets: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^([-*•·]|\d+[.)])\s+/.test(line)) {
      bullets.push(line.replace(/^([-*•·]|\d+[.)])\s+/, "").trim());
      if (bullets.length >= max) break;
    }
  }
  return bullets;
}

/* ---------- coercion helpers ---------- */
function strOr(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}
function strOrUndefined(v: unknown): string | undefined {
  return typeof v === "string" && v.length ? v : undefined;
}
function numOr(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function clamp01to10(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(10, v));
}
function normalizeConfidence(v: unknown): Confidence {
  if (v === "high" || v === "medium" || v === "medium-low" || v === "low") return v;
  return "low";
}
function normalizeTokenUsage(v: unknown): TokenUsageSummary | undefined {
  if (!v || typeof v !== "object") return undefined;
  const obj = v as TokenUsageSummary;
  if (!obj.totals) return undefined;
  return obj;
}
async function safeText(r: Response): Promise<string> {
  try {
    return (await r.text()).slice(0, 500);
  } catch {
    return "";
  }
}
