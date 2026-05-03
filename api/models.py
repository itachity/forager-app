"""
Pydantic models for the Forager API.

Mirrors the frontend's UserProfile (TypeScript) so requests are validated at the
API boundary. Defaults here are intentional contract decisions, not hidden
fallbacks: if a field is absent, the documented default applies.
"""

from typing import Literal, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# UserProfile (mirrors frontend type)
# ---------------------------------------------------------------------------

SpiceTolerance = Literal["none", "mild", "medium", "hot", "any"]
Budget = Literal["cheap", "moderate", "expensive", "any"]
GoalType = Literal[
    "balanced",
    "high_protein",
    "low_calorie",
    "low_carb",
    "bulking",
    "cutting",
    "maintenance",
    "none",
]
Language = Literal["en", "ja", "zh", "tl", "ru", "es"]
ProfileMode = Literal["normal", "cheat_day", "guest"]


class DietRules(BaseModel):
    halal: bool = False
    kosher: bool = False
    vegetarian: bool = False
    vegan: bool = False
    pescatarian: bool = False
    glutenFree: bool = False
    dairyFree: bool = False
    nutFree: bool = False


class Dietary(BaseModel):
    allergens: list[str] = Field(default_factory=list)
    avoidIngredients: list[str] = Field(default_factory=list)
    dietRules: DietRules = Field(default_factory=DietRules)
    spiceTolerance: SpiceTolerance = "any"


class Preferences(BaseModel):
    budget: Budget = "any"
    maxDistanceMiles: float = 5.0
    likedCuisines: list[str] = Field(default_factory=list)
    dislikedCuisines: list[str] = Field(default_factory=list)
    likedFoods: list[str] = Field(default_factory=list)
    dislikedFoods: list[str] = Field(default_factory=list)
    preferredOrderTerms: list[str] = Field(default_factory=list)
    avoidOrderTerms: list[str] = Field(default_factory=list)


class NutritionGoals(BaseModel):
    goalType: GoalType = "none"
    caloriesMax: Optional[int] = None
    caloriesMin: Optional[int] = None
    proteinMinGrams: Optional[int] = None
    carbsMaxGrams: Optional[int] = None
    fatMaxGrams: Optional[int] = None


class LanguageSettings(BaseModel):
    preferredLanguage: Language = "en"
    explainCulturalNorms: bool = False


class Privacy(BaseModel):
    saveLocationHistory: bool = True
    saveMealHistory: bool = True
    useProfileForRecommendations: bool = True


class UserProfile(BaseModel):
    id: str
    authUserId: Optional[str] = None
    displayName: Optional[str] = None
    email: Optional[str] = None
    profileMode: ProfileMode = "guest"
    dietary: Dietary = Field(default_factory=Dietary)
    preferences: Preferences = Field(default_factory=Preferences)
    nutritionGoals: NutritionGoals = Field(default_factory=NutritionGoals)
    language: LanguageSettings = Field(default_factory=LanguageSettings)
    privacy: Privacy = Field(default_factory=Privacy)
    createdAt: str
    updatedAt: str


def guest_profile() -> UserProfile:
    """
    Default profile applied when the frontend sends `user_profile: null`
    (e.g. Supabase auth not yet wired, or browser denied geolocation).
    profileMode='guest' so prompts/ranking know not to assume restrictions.
    """
    return UserProfile(
        id="guest",
        profileMode="guest",
        createdAt="",
        updatedAt="",
    )


# ---------------------------------------------------------------------------
# Request / response shapes for /chat and /analyze-menu
# ---------------------------------------------------------------------------


class Location(BaseModel):
    latitude: float = Field(ge=-90.0, le=90.0)
    longitude: float = Field(ge=-180.0, le=180.0)


class ChatRequest(BaseModel):
    message: str
    location: Optional[Location] = None
    user_profile: Optional[UserProfile] = None


class EstimatedMacros(BaseModel):
    calories: str
    protein: str
    carbs: str
    fat: str
    confidence: Literal["high", "medium", "low"]


class Recommendation(BaseModel):
    place: str
    order: str
    estimated_macros: EstimatedMacros
    why: str
    distance_miles: Optional[float] = None
    price_level: Optional[str] = None
    rating: Optional[float] = None
    user_rating_count: Optional[int] = None
    open_now: Optional[bool] = None
    google_maps_uri: Optional[str] = None
    suggested_modifications: list[str] = Field(default_factory=list)
    allergen_warnings: list[str] = Field(default_factory=list)


class ChatResponse(BaseModel):
    answer: str
    tools_used: list[str]
    recommendations: list[Recommendation]


class MenuRecommendation(BaseModel):
    dish_original: str
    dish_translated: Optional[str] = None
    likely_ingredients: list[str] = Field(default_factory=list)
    estimated_macros: EstimatedMacros
    why: str
    suggested_modifications: list[str] = Field(default_factory=list)
    allergen_warnings: list[str] = Field(default_factory=list)
    cultural_notes: Optional[str] = None
    questions_for_waiter: list[str] = Field(default_factory=list)


class AnalyzeMenuResponse(BaseModel):
    detected_language: str
    summary: str
    tools_used: list[str]
    recommendations: list[MenuRecommendation]
