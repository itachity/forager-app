export type LanguageCode = "en" | "ja" | "zh" | "tl" | "ru" | "es";

export type SpiceTolerance = "none" | "mild" | "medium" | "hot" | "any";

export type Budget = "cheap" | "moderate" | "expensive" | "any";

export type GoalType =
  | "balanced"
  | "high_protein"
  | "low_calorie"
  | "low_carb"
  | "bulking"
  | "cutting"
  | "maintenance"
  | "none";

export type ProfileMode = "normal" | "cheat_day" | "guest";

export type DietRules = {
  halal: boolean;
  kosher: boolean;
  vegetarian: boolean;
  vegan: boolean;
  pescatarian: boolean;
  glutenFree: boolean;
  dairyFree: boolean;
  nutFree: boolean;
};

export type UserProfile = {
  id: string;
  authUserId?: string | null;
  displayName?: string | null;
  email?: string | null;
  profileMode: ProfileMode;
  dietary: {
    allergens: string[];
    avoidIngredients: string[];
    dietRules: DietRules;
    spiceTolerance: SpiceTolerance;
  };
  preferences: {
    budget: Budget;
    maxDistanceMiles: number;
    likedCuisines: string[];
    dislikedCuisines: string[];
    likedFoods: string[];
    dislikedFoods: string[];
    preferredOrderTerms: string[];
    avoidOrderTerms: string[];
  };
  nutritionGoals: {
    goalType: GoalType;
    caloriesMax?: number | null;
    caloriesMin?: number | null;
    proteinMinGrams?: number | null;
    carbsMaxGrams?: number | null;
    fatMaxGrams?: number | null;
  };
  language: {
    preferredLanguage: LanguageCode;
    explainCulturalNorms: boolean;
  };
  privacy: {
    saveLocationHistory: boolean;
    saveMealHistory: boolean;
    useProfileForRecommendations: boolean;
  };
  createdAt: string;
  updatedAt: string;
};

export type GeoLocation = {
  lat: number;
  lng: number;
  city?: string;
  country?: string;
};

export type ChatRequest = {
  message: string;
  user_profile: UserProfile;
  location?: GeoLocation;
};

export type Confidence = "high" | "medium" | "medium-low" | "low";

export type ChatRecommendation = {
  rank: number;
  place: string;
  address: string;
  score: number;
  order: string;
  calories?: string;
  protein?: string;
  carbs?: string;
  fat?: string;
  confidence?: Confidence;
  why: string;
  tradeoffs?: string;
  sources_used: string[];
  google_maps_url?: string;
};

export type ToolTraceEntry = {
  tool: string;
  status: "ok" | "error" | "skipped" | string;
  count?: number;
  reason?: string;
  error?: string;
  output?: unknown;
  weights?: Record<string, number>;
  queries?: string[];
  radius_meters?: number;
};

export type ChatResponse = {
  answer: string;
  recommendations: ChatRecommendation[];
  tool_trace?: ToolTraceEntry[];
  limitations?: string[];
};

export type FollowUpQuestion = {
  id: string;
  question: string;
  options: string[];
};

export type FoodMacros = {
  caloriesMin: number;
  caloriesMax: number;
  proteinMinG: number;
  proteinMaxG: number;
  carbsMinG: number;
  carbsMaxG: number;
  fatMinG: number;
  fatMaxG: number;
  servingNote: string;
};

export type AnalyzeFoodResponse = {
  dish: string;
  confidence: number; // 0..1
  cuisine?: string;
  ingredients: string[];
  followUpQuestions: FollowUpQuestion[];
  macros: FoodMacros;
  logSuggestions: string[];
  nextOrderTips: string[];
};

export type MenuItem = {
  originalName: string;
  translatedName: string;
  description: string;
  matchScore: number; // 0..10
  whyRanked: string;
  culturalNote?: string;
  phraseToOrder?: string;
  ingredients?: string[];
  category?: string;
  goalFitScore?: number;
  riskFlags?: { calorieRisk?: string; carbRisk?: string; fatRisk?: string };
};

export type AnalyzeMenuResponse = {
  detectedLanguage: string;
  cuisine: string;
  overallCulturalNorms: string[];
  rankedItems: MenuItem[];
  prose?: string;
};

export type ApiResult<T> =
  | { ok: true; data: T; demo?: boolean }
  | { ok: false; error: string; demo?: boolean; data?: T };
