from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any

app = FastAPI(title="Forager API")

origins = [
    "http://localhost:3000",
    "https://forager-app.vercel.app",
    "https://forager-app.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    user_profile: Dict[str, Any] = {}

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "forager-api"
    }

@app.post("/chat")
def chat(req: ChatRequest):
    return {
        "answer": f"Forager received your request: {req.message}",
        "tools_used": ["stub_agent"],
        "recommendations": [
            {
                "place": "Example Bowl Spot",
                "order": "Chicken rice bowl",
                "estimated_macros": {
                    "calories": "650-800 kcal",
                    "protein": "35-50 g",
                    "carbs": "60-90 g",
                    "fat": "15-30 g",
                    "confidence": "medium"
                },
                "why": "Cheap, high-protein, and close to campus."
            }
        ]
    }

@app.post("/analyze-menu")
async def analyze_menu(file: UploadFile = File(...)):
    return {
        "filename": file.filename,
        "summary": "Menu image received.",
        "recommendations": [
            {
                "dish": "Example translated dish",
                "reason": "Likely filling and reasonable for a high-protein meal.",
                "allergen_warning": "Verify ingredients with the restaurant before ordering."
            }
        ]
    }