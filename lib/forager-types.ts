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

export type TokenUsageCall = {
  provider: "nvidia" | string;
  model: string;
  route: string;
  purpose: string;
  retry?: boolean;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details?: unknown;
  completion_tokens_details?: unknown;
};

export type TokenUsageSummary = {
  provider: "nvidia" | string;
  model: string;
  calls: TokenUsageCall[];
  totals: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    call_count: number;
  };
};

export type OrderSuggestion = {
  name: string;
  modifications: string[];
  estimated_macros: {
    calories: string;
    protein: string;
    carbs: string;
    fat: string;
    confidence: Confidence;
  };
  why: string;
  /** Nemotron-estimated price range, anchored on Google priceLevel + cuisine. */
  price_range_usd?: { min: number; max: number };
  price_confidence?: "high" | "medium" | "low";
};

export type TodayHours = {
  day: string;
  open: string | null;
  close: string | null;
  open_now: boolean;
  closes_at: string | null;
  is_24h: boolean;
  is_closed_today: boolean;
  timezone: string | null;
};

export type RecommendationEvidence = {
  profile_fields_cited: string[];
  prompt_phrases_cited: string[];
};

export type ChatRecommendation = {
  rank: number;
  place: string;
  address: string;
  score: number;

  /** Backward-compatible single order shown by older UI cards. */
  order?: string;

  /** New preferred shape: at least 3 order ideas per restaurant. */
  order_suggestions?: OrderSuggestion[];

  calories?: string;
  protein?: string;
  carbs?: string;
  fat?: string;
  confidence?: Confidence;
  why: string;
  tradeoffs?: string;
  sources_used: string[];
  google_maps_url?: string;

  /** Display label like "$" / "$$" / "$$$" — populated when backend
   * surfaces Google Places `priceLevel`. */
  price?: string;

  /** Estimated meal price in USD when known. */
  price_usd?: number;

  /** Estimated price range in USD for the primary order suggestion. */
  price_range_usd?: { min: number; max: number };
  price_confidence?: "high" | "medium" | "low";

  /** Short user-review quotes pulled from Google Places (max ~2). Optional. */
  review_quotes?: string[];

  /** Restaurant lat/lng (from Google Places). Used for ResultsMap pins. */
  lat?: number;
  lng?: number;

  /** Restaurant website (from Google Places websiteUri). Used for "View menu" link. */
  website?: string;

  /** Today's opening hours in the restaurant's local time. Used by TimeCard. */
  opening_hours_today?: TodayHours;

  /** Which user-profile fields and prompt phrases the model cited in `why`. */
  evidence?: RecommendationEvidence;
};

export type ToolTraceEntry = {
  tool: string;
  status: "ok" | "error" | "skipped" | string;
  count?: number;
  reason?: string | null;
  error?: string;
  output?: unknown;
  weights?: Record<string, number | string>;
  queries?: string[];
  radius_meters?: number;
};

export type ChatResponse = {
  answer: string;
  recommendations: ChatRecommendation[];
  tool_trace?: ToolTraceEntry[];
  limitations?: string[];
  token_usage?: TokenUsageSummary;
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
  status?: "ok" | "error" | string;
  filename?: string;
  dish: string;
  confidence: number; // 0..1
  cuisine?: string | null;
  detectedLanguage?: string | null;
  recordText?: string | null;
  record_text?: string;
  ingredients: string[];
  followUpQuestions: FollowUpQuestion[];
  macros: FoodMacros;
  logSuggestions: string[];
  nextOrderTips: string[];
  structured_identification?: unknown;
  usda_references?: unknown[];
  tools_used?: string[];
  token_usage?: TokenUsageSummary;
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
  status?: "ok" | "error" | string;
  detectedLanguage: string;
  cuisine: string;
  overallCulturalNorms: string[];
  rankedItems: MenuItem[];
  prose?: string;
  record_text?: string;
  profile_context?: unknown;
  menu_description?: string;
  structured_analysis?: unknown;
  usda_references?: unknown[];
  tools_used?: string[];
  token_usage?: TokenUsageSummary;
};

export type ApiResult<T> =
  | { ok: true; data: T; demo?: boolean }
  | { ok: false; error: string; demo?: boolean; data?: T };
