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
  ToolTraceEntry,
  UserProfile,
} from "./forager-types";
import { goalStringFromProfile, LANGUAGE_DISPLAY_NAME } from "./forager-mappings";
import { DEMO_CHAT, DEMO_FOOD_ANALYSIS, DEMO_MENU_ANALYSIS } from "./forager-fallback";
import { resizeImage } from "./forager-image";
import { phrasesForProfile } from "./forager-phrases";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
  signal?: AbortSignal
): Promise<ApiResult<AnalyzeFoodResponse>> {
  try {
    const blob = await resizeImage(file);
    const fd = new FormData();
    fd.append("file", blob, file.name || "meal.jpg");
    fd.append("profile", JSON.stringify(profile));
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
  signal?: AbortSignal
): Promise<ApiResult<AnalyzeMenuResponse>> {
  try {
    const blob = await resizeImage(file);
    const fd = new FormData();
    fd.append("file", blob, file.name || "menu.jpg");
    fd.append("goal", goalStringFromProfile(profile));
    fd.append("profile", JSON.stringify(profile));
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
  const recommendations: ChatRecommendation[] = recs.map((r, idx) => {
    const macros = (r.estimated_macros as Record<string, unknown> | undefined) ?? undefined;
    return {
      rank: numOr(r.rank, idx + 1),
      place: strOr(r.place, "Unknown"),
      address: strOr(r.address, ""),
      score: numOr(r.score, 0),
      order: strOr(r.order, ""),
      calories: macros ? strOrUndefined(macros.calories) : undefined,
      protein: macros ? strOrUndefined(macros.protein) : undefined,
      carbs: macros ? strOrUndefined(macros.carbs) : undefined,
      fat: macros ? strOrUndefined(macros.fat) : undefined,
      confidence: macros ? (macros.confidence as Confidence | undefined) : undefined,
      why: strOr(r.why, ""),
      tradeoffs: strOrUndefined(r.tradeoffs),
      sources_used: Array.isArray(r.sources_used) ? (r.sources_used as string[]) : [],
      google_maps_url: strOrUndefined(r.google_maps_url),
    };
  });
  return {
    answer: strOr(raw.answer, ""),
    recommendations,
    tool_trace: Array.isArray(raw.tool_trace) ? (raw.tool_trace as ToolTraceEntry[]) : undefined,
    limitations: Array.isArray(raw.limitations) ? (raw.limitations as string[]) : undefined,
  };
}

function normalizeFoodResponse(raw: Record<string, unknown>): AnalyzeFoodResponse {
  // If backend returns the canonical shape directly, just trust it (best-effort
  // shape coercion). Otherwise fall back to demo to avoid crashes.
  const macros = (raw.macros as Record<string, unknown> | undefined) ?? {};
  return {
    dish: strOr(raw.dish, "Unknown dish"),
    confidence: numOr(raw.confidence, 0.5),
    cuisine: strOrUndefined(raw.cuisine),
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
    detectedLanguage:
      strOrUndefined(detLang.name) ??
      LANGUAGE_DISPLAY_NAME[profile.language.preferredLanguage] ??
      "Unknown",
    cuisine: strOr(ctx.restaurant_type, "Restaurant"),
    overallCulturalNorms,
    rankedItems,
    prose,
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
  // Use the first allergy-relevant phrase if any, else fall back to "could I have water" which
  // we replace with the dish name in English. Keep it simple for the hackathon.
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
async function safeText(r: Response): Promise<string> {
  try {
    return (await r.text()).slice(0, 500);
  } catch {
    return "";
  }
}
