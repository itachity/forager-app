# Forager

Forager helps you discover hidden food gems tailored to your taste, goals, and mood. Snap a meal or translate a menu in any language, then chat with the agent for recommendations near you.

The repo contains two pieces:

- A **Next.js 16** frontend (App Router, React 19, Tailwind v4, shadcn/Radix UI, `@vis.gl/react-google-maps`, Supabase auth).
- A **FastAPI** backend in `api/` that wraps an NVIDIA Nemotron-powered agent and talks to Google Maps + USDA.
# 🌰 Forager

> **Find the right meal anywhere, in any language.**
> An AI-powered food decision assistant built on **NVIDIA Nemotron 3 Nano Omni** that helps you decide *where* to eat, *what* to order, and *how well* a meal fits your goals — combining restaurant data, menu translation, food photo analysis, and macro-aware reasoning into one personalized agent loop.

### Frontend

Install dependencies and run the dev server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The entry point is `app/page.tsx` and the layout lives in `app/layout.tsx`. Hot reload is on by default.

### Backend

The frontend talks to the FastAPI service at `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000`). To run it:

```bash
cd api
python -m venv .venv
.venv\Scripts\activate         # PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

If the backend is unreachable, the frontend falls back to bundled demo data so the UI still works end-to-end.

### Environment variables

Copy `.env.example` to `.env.local` (frontend) and `api/.env` (backend) and fill in the keys:

- `NEXT_PUBLIC_API_URL` — backend URL used by the browser.
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — required for Google sign-in. Without them, the landing page surfaces a toast and only "Continue as Guest" works.
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — enables the interactive results map; when unset, the UI falls back to a lightweight iframe map.
- Backend: `NVIDIA_API_KEY`, `GOOGLE_MAPS_API_KEY`, `USDA_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, optional `NEMOTRON_MODEL`, and `DEFAULT_LAT` / `DEFAULT_LNG` / `DEFAULT_CITY` / `DEFAULT_COUNTRY` for the demo location.

## Project structure

- `app/` — App Router pages: landing, onboarding, home, discover, chat, profile, scan (food + menu), and results.
- `components/` — UI primitives (shadcn-style) plus Forager-specific components.
- `lib/` — client helpers: API client (`forager-api.ts`), Supabase wiring, profile/i18n state, image resizing, fallbacks.
- `api/` — FastAPI app (`main.py`) and the agent implementation (`agent.py`).

## Notes

- This project pins Next.js 16 and React 19. Their APIs and conventions differ from earlier versions — check the docs in `node_modules/next/dist/docs/` before adding code that relies on Next.js behavior.
- Fonts are loaded with `next/font/google` (Geist Sans + Geist Mono) in `app/layout.tsx`.
- The branch `mj-dev` is the active development branch; `main` is the integration branch.
Built for **BeaverHacks 2026** at Oregon State University, May 2–3.

---

## What it does

Forager replaces the "open five tabs and still can't decide" problem with one place that reasons across all of them. Three flows we ship:

1. **Search by craving.** *"I want cheap high-protein food near OSU."* Forager extracts intent, searches Google Places, scores menus against your dietary profile, and returns 2–3 ranked picks with macros, reasoning, and tradeoffs — all in under 10 seconds.
2. **Snap your meal.** Photograph what you're about to eat. Nemotron's vision encoder identifies the dish, estimates calories/protein/carbs/fat as ranges with confidence, and suggests how to log or improve the order. Allergens you flagged in onboarding get a red warning before you ever pay.
3. **Translate a menu.** In a foreign country and can't read the menu? Photograph it. Nemotron translates every dish, flags allergens against your profile, ranks the options, and gives you culturally-appropriate phrases (with phonetic spelling) to ask the server.

The whole experience is mobile-first and accessible in 6 languages: **English, Español, 日本語, 中文, Tagalog, Русский.**

---

## Why Nemotron is central

Nemotron 3 Nano Omni is the only model in this stack. Not a chatbot wrapper — the agent itself.

- **Vision + reasoning in one model.** Most omni stacks need a separate vision model, a separate translation model, and a separate planner. Nemotron unifies all three. We send a menu photo and a system prompt and get back structured JSON with translation, ingredients, and per-dish allergen flags in a single call.
- **Tool calling.** Nemotron decides which tools to invoke (Google Places, USDA macros, sample menu lookup) and in what order. We don't hand-route — the model plans.
- **Reasoning mode.** When confidence matters (a vague food photo, an ambiguous menu item), Nemotron's reasoning trace is exposed to the user as the *"How Forager decided"* panel. Judges and users can both see what the model considered.
- **256K context window.** A whole foreign menu photo + the full user profile + tool results all fit in a single conversation, so the model never loses track of allergens partway through reasoning.

For demo and inference we call NVIDIA's hosted NIM endpoint at `integrate.api.nvidia.com/v1` using the OpenAI-compatible client.

---

## Tech stack

**Frontend** — Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui · lucide-react. Mobile-first responsive layout, 480-px content column on desktop. Profile state hydrated from Supabase or localStorage on every page mount.

**Backend** — FastAPI (Python 3.12) · uvicorn · Pillow (image resize) · httpx (async HTTP) · OpenAI Python SDK (pointed at NVIDIA's NIM endpoint). Endpoints: `GET /health`, `POST /chat`, `POST /analyze-menu`, `POST /analyze-food`. CORS-locked to the deployed Vercel domain.

**AI / Agent** — NVIDIA Nemotron 3 Nano Omni (`nemotron-3-nano-omni-30b-a3b-reasoning`) for *every* call. Hybrid Mamba-Transformer MoE, 30B parameters / 3B active, 256K context, multimodal (text + image). Tool-calling enabled via the OpenAI function-calling API spec.

**Data sources** —
- **Google Places API** — restaurant discovery, ratings, hours, distance, price level
- **USDA FoodData Central** — macro lookup for identified foods
- **Sample menu JSON** (5 restaurants near OSU) — fallback for restaurants without public menus

**Profile / auth** — Supabase (Postgres + Auth) · Google OAuth via Supabase. Guest mode supported (no DB write). Profile schema is JSONB-backed for flexibility.

**Caching** — Disk-backed pickle cache hashed on `function-name + args`. Same demo query twice = single API hit. Critical for booth demos with flaky Wi-Fi.

**Deploy** — Frontend on Vercel (Root: repo root). Backend on Railway (Root: `api/`). Supabase project hosted on supabase.com.

---

## Architecture at a glance

```
┌──────────────┐       ┌──────────────┐       ┌────────────────────┐
│  Next.js UI  │──────▶│   FastAPI    │──────▶│  Nemotron 3 Nano   │
│  (Vercel)    │◀──────│  (Railway)   │◀──────│  Omni (NVIDIA NIM) │
└──────────────┘       └──────┬───────┘       └────────────────────┘
       ▲                      │
       │                      ▼
   ┌───┴────┐         ┌─────────────────┐
   │Supabase│         │ Tool layer:     │
   │profiles│         │ • Google Places │
   └────────┘         │ • USDA macros   │
                      │ • Sample menus  │
                      │ + pickle cache  │
                      └─────────────────┘
```

Single agent loop in `api/agent.py`:

1. **Plan** — Nemotron receives the user message + profile + (optional) image. It decides which tools to call.
2. **Dispatch** — FastAPI executes the tool calls in parallel where safe (restaurants + macros), serially where the next call depends on the previous (menu lookup needs a restaurant ID).
3. **Synthesize** — Tool results fed back to Nemotron with a final-answer system prompt. Output is structured JSON validated against a Pydantic schema.
4. **Stream** — Response streamed back to the frontend. The frontend renders the recommendation cards as they arrive.

---

## Recommendation scoring

Forager's ranking is a transparent weighted sum, not a black box. Every score is visible to the user as a "Match XX" badge.

| Factor | Weight |
|---|---|
| Restaurant rating (Google) | 20% |
| Availability (open now / closing soon) | 20% |
| Preference match (cuisine, craving, restrictions) | 15% |
| Community sentiment | 15% |
| Distance | 10% |
| Price fit (vs budget) | 10% |
| Macro fit (vs nutrition goal) | 10% |

Allergen violations are **not** scored — they are a hard exclusion. A dish with a flagged allergen never enters the ranking pool. We surface it instead with a red `AllergenFlag` chip and a one-line explanation.

---

## Trust & safety

- Macros are always rendered as **ranges with confidence** (high / medium / low). No fake precision.
- Every recommendation lists **sources used** — Google, USDA, Nemotron, etc.
- Allergen warnings are inline, in red, and accompanied by *"verify with the restaurant"* — Forager flags risks; it doesn't make medical claims.
- We don't store Reddit content. We don't claim community sentiment unless the model returns it.
- The agent's tool-call trace is exposed to the user as a collapsible *"How Forager decided"* panel.

---

## Run it locally

**Prerequisites:** Node 20+, Python 3.12+, an NVIDIA Build API key, Google Places API key, USDA FoodData Central API key.

### Frontend

```bash
cp .env.example .env.local
# fill in NEXT_PUBLIC_API_URL, optionally NEXT_PUBLIC_SUPABASE_*
npm install
npm run dev
# http://localhost:3000
```

### Backend

```bash
cd api
python -m venv .venv
.\.venv\Scripts\Activate.ps1   # Windows
# source .venv/bin/activate    # macOS/Linux
pip install -r requirements.txt
cp .env.example .env
# fill in NVIDIA_API_KEY, GOOGLE_MAPS_API_KEY, USDA_API_KEY
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
# http://localhost:8000/health
```

The frontend talks to `${NEXT_PUBLIC_API_URL}` (defaults to `http://localhost:8000`). If the backend is unreachable, the frontend falls back to a demo dataset with a visible *"Demo data"* banner.

---

## Repository layout

```
forager-app/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # welcome screen
│   ├── onboarding/         # 8-step profile wizard
│   ├── home/               # search + scan entry cards
│   ├── results/            # ranked recommendations + map
│   ├── scan/food/          # Flow 2 — snap your meal
│   ├── scan/menu/          # Flow 5 — translate a menu
│   └── discover/           # food card discovery
├── components/forager/     # custom branded components
├── components/ui/          # shadcn primitives
├── lib/                    # API clients, types, mappings, fallback data
├── api/                    # FastAPI backend
│   ├── main.py             # endpoints + CORS
│   ├── agent.py            # Nemotron agent loop
│   ├── tools/              # Google Places, USDA, sample menu wrappers
│   ├── cache.py            # disk pickle cache
│   └── data/               # sample_menus.json
├── public/                 # icons, brand assets
├── AGENTS.md               # dev notes for AI assistants
├── CLAUDE.md               # references AGENTS.md
└── README.md               # you are here
```

---

## Submission

- **Track:** NVIDIA — Best Use of Nemotron
- **AI tooling disclosure:** Claude Opus 4.7 (boilerplate, prompt engineering, code review), GPT5.5 for debugging and general-purpose questions. Architecture decisions, scoring weights, agent loop design, system prompts, and demo flow were authored by the team.

---

## License

MIT. See [LICENSE](./LICENSE).

## Team

Built at OSU during BeaverHacks 2026 by Hungry Students.
