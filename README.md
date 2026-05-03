# Forager

Forager helps you discover hidden food gems tailored to your taste, goals, and mood. Snap a meal or translate a menu in any language, then chat with the agent for recommendations near you.

The repo contains two pieces:

- A **Next.js 16** frontend (App Router, React 19, Tailwind v4, shadcn/Radix UI, `@vis.gl/react-google-maps`, Supabase auth).
- A **FastAPI** backend in `api/` that wraps an NVIDIA Nemotron-powered agent and talks to Google Maps + USDA.

## Getting Started

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
