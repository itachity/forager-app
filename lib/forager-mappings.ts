import type {
  Budget,
  DietRules,
  GoalType,
  LanguageCode,
  SpiceTolerance,
  UserProfile,
} from "./forager-types";

export const SPICE_LABELS: { label: string; value: SpiceTolerance }[] = [
  { label: "None", value: "none" },
  { label: "Mild", value: "mild" },
  { label: "Medium", value: "medium" },
  { label: "Hot", value: "hot" },
  { label: "Bring the heat", value: "any" },
];

export const BUDGET_LABELS: { label: string; value: Budget }[] = [
  { label: "$ Cheap eats", value: "cheap" },
  { label: "$$ Moderate", value: "moderate" },
  { label: "$$$ Treat me", value: "expensive" },
  { label: "Any", value: "any" },
];

export const DIET_RULE_LABELS: { label: string; key: keyof DietRules }[] = [
  { label: "Vegetarian", key: "vegetarian" },
  { label: "Vegan", key: "vegan" },
  { label: "Pescatarian", key: "pescatarian" },
  { label: "Gluten-Free", key: "glutenFree" },
  { label: "Dairy-Free", key: "dairyFree" },
  { label: "Nut-Free", key: "nutFree" },
  { label: "Halal", key: "halal" },
  { label: "Kosher", key: "kosher" },
];

export const GOAL_LABELS: { label: string; emoji: string; value: GoalType }[] = [
  { label: "Balanced", emoji: "🥗", value: "balanced" },
  { label: "High Protein", emoji: "💪", value: "high_protein" },
  { label: "Low Calorie", emoji: "🌱", value: "low_calorie" },
  { label: "Low Carb", emoji: "🥑", value: "low_carb" },
  { label: "Bulking", emoji: "🔥", value: "bulking" },
  { label: "Cutting", emoji: "✂️", value: "cutting" },
  { label: "Maintenance", emoji: "⚖️", value: "maintenance" },
  { label: "No goal", emoji: "✨", value: "none" },
];

export const LANGUAGE_LABELS: { label: string; value: LanguageCode }[] = [
  { label: "English", value: "en" },
  { label: "Español", value: "es" },
  { label: "日本語", value: "ja" },
  { label: "中文", value: "zh" },
  { label: "Tagalog", value: "tl" },
  { label: "Русский", value: "ru" },
];

export const LANGUAGE_DISPLAY_NAME: Record<LanguageCode, string> = {
  en: "English",
  es: "Spanish",
  ja: "Japanese",
  zh: "Chinese",
  tl: "Tagalog",
  ru: "Russian",
};

export const COMMON_ALLERGENS = [
  "Peanuts",
  "Tree Nuts",
  "Shellfish",
  "Eggs",
  "Soy",
  "Wheat",
  "Sesame",
];

export const CUISINES = [
  "Japanese",
  "Italian",
  "Mexican",
  "Thai",
  "Indian",
  "Mediterranean",
  "Korean",
  "Vietnamese",
  "American",
  "Chinese",
  "French",
  "Filipino",
];

export function dietLabelOf(key: keyof DietRules): string {
  return DIET_RULE_LABELS.find((r) => r.key === key)?.label ?? key;
}

export function goalLabelOf(value: GoalType): string {
  return GOAL_LABELS.find((g) => g.value === value)?.label ?? "Surprise me";
}

export function spiceLabelOf(value: SpiceTolerance): string {
  return SPICE_LABELS.find((s) => s.value === value)?.label ?? "Any";
}

export function budgetLabelOf(value: Budget): string {
  return BUDGET_LABELS.find((b) => b.value === value)?.label ?? "Any";
}

export function languageLabelOf(value: LanguageCode): string {
  return LANGUAGE_LABELS.find((l) => l.value === value)?.label ?? "English";
}

export function activeDietRules(rules: DietRules): string[] {
  return DIET_RULE_LABELS.filter((r) => rules[r.key]).map((r) => r.label);
}

/**
 * Compose a one-line "goal" string the FastAPI /analyze-menu backend can
 * parse. Mirrors how a human would describe their preference at the moment of
 * ordering: nutrition goal → diet rules → allergens → budget → calorie cap.
 */
export function goalStringFromProfile(profile: UserProfile): string {
  const parts: string[] = [];
  const goal = profile.nutritionGoals.goalType;
  if (goal && goal !== "none") {
    parts.push(goalPhrase(goal));
  }
  const diet = activeDietRules(profile.dietary.dietRules);
  if (diet.length) parts.push(diet.map((d) => d.toLowerCase()).join(", "));
  if (profile.dietary.allergens.length) {
    parts.push(`no ${profile.dietary.allergens.map((a) => a.toLowerCase()).join(", no ")}`);
  }
  if (profile.dietary.avoidIngredients.length) {
    parts.push(`avoid ${profile.dietary.avoidIngredients.map((a) => a.toLowerCase()).join(", ")}`);
  }
  const budget = profile.preferences.budget;
  if (budget && budget !== "any") parts.push(budgetPhrase(budget));
  const cap = profile.nutritionGoals.caloriesMax;
  if (cap) parts.push(`under ${cap} kcal`);
  const result = parts.filter(Boolean).join(", ").trim();
  return result || "a dish that fits a balanced meal";
}

function goalPhrase(g: GoalType): string {
  switch (g) {
    case "balanced": return "balanced meal";
    case "high_protein": return "high-protein";
    case "low_calorie": return "low-calorie";
    case "low_carb": return "low-carb";
    case "bulking": return "high-calorie for bulking";
    case "cutting": return "lean for cutting";
    case "maintenance": return "moderate maintenance meal";
    default: return "balanced meal";
  }
}

function budgetPhrase(b: Budget): string {
  switch (b) {
    case "cheap": return "cheap";
    case "moderate": return "moderately priced";
    case "expensive": return "premium";
    default: return "";
  }
}

/* ---------- Supabase row <-> profile ---------- */

export type ProfileRow = {
  id: string;
  auth_user_id: string | null;
  display_name: string | null;
  email: string | null;
  profile_mode: string;
  dietary: UserProfile["dietary"];
  preferences: UserProfile["preferences"];
  nutrition_goals: UserProfile["nutritionGoals"];
  language: UserProfile["language"];
  privacy: UserProfile["privacy"];
  created_at: string;
  updated_at: string;
};

export function profileToRow(p: UserProfile): ProfileRow {
  return {
    id: p.id,
    auth_user_id: p.authUserId ?? null,
    display_name: p.displayName ?? null,
    email: p.email ?? null,
    profile_mode: p.profileMode,
    dietary: p.dietary,
    preferences: p.preferences,
    nutrition_goals: p.nutritionGoals,
    language: p.language,
    privacy: p.privacy,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

export function rowToProfile(r: ProfileRow): UserProfile {
  return {
    id: r.id,
    authUserId: r.auth_user_id,
    displayName: r.display_name,
    email: r.email,
    profileMode: (r.profile_mode as UserProfile["profileMode"]) ?? "normal",
    dietary: r.dietary,
    preferences: r.preferences,
    nutritionGoals: r.nutrition_goals,
    language: r.language,
    privacy: r.privacy,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
