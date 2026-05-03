import type { UserProfile } from "./forager-types";
import { saveProfileRemote } from "./forager-supabase";

const STORAGE_KEY = "forager:profile";

export function defaultProfile(): UserProfile {
  const now = new Date().toISOString();
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    authUserId: null,
    displayName: null,
    email: null,
    profileMode: "normal",
    dietary: {
      allergens: [],
      avoidIngredients: [],
      dietRules: {
        halal: false,
        kosher: false,
        vegetarian: false,
        vegan: false,
        pescatarian: false,
        glutenFree: false,
        dairyFree: false,
        nutFree: false,
      },
      spiceTolerance: "any",
    },
    preferences: {
      budget: "any",
      maxDistanceMiles: 5,
      likedCuisines: [],
      dislikedCuisines: [],
      likedFoods: [],
      dislikedFoods: [],
      preferredOrderTerms: [],
      avoidOrderTerms: [],
    },
    nutritionGoals: { goalType: "balanced" },
    language: { preferredLanguage: "en", explainCulturalNorms: false },
    privacy: {
      saveLocationHistory: false,
      saveMealHistory: false,
      useProfileForRecommendations: true,
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function loadProfileLocal(): UserProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    return mergeWithDefaults(parsed);
  } catch (e) {
    console.warn("[forager] loadProfileLocal failed", e);
    return null;
  }
}

export function saveProfileLocal(profile: UserProfile): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.warn("[forager] saveProfileLocal failed", e);
  }
}

export function clearProfileLocal(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

/** Save to localStorage always; also upsert to Supabase if signed in non-guest. */
export async function persistProfile(profile: UserProfile): Promise<void> {
  saveProfileLocal(profile);
  if (profile.profileMode !== "guest" && profile.authUserId) {
    await saveProfileRemote(profile);
  }
}

/** Defensive: merge a possibly-partial stored profile with defaults so a code
 * change that adds a new field doesn't crash on read. */
function mergeWithDefaults(partial: Partial<UserProfile>): UserProfile {
  const def = defaultProfile();
  return {
    ...def,
    ...partial,
    dietary: {
      ...def.dietary,
      ...(partial.dietary ?? {}),
      dietRules: {
        ...def.dietary.dietRules,
        ...(partial.dietary?.dietRules ?? {}),
      },
    },
    preferences: { ...def.preferences, ...(partial.preferences ?? {}) },
    nutritionGoals: { ...def.nutritionGoals, ...(partial.nutritionGoals ?? {}) },
    language: { ...def.language, ...(partial.language ?? {}) },
    privacy: { ...def.privacy, ...(partial.privacy ?? {}) },
  };
}
