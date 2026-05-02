# Scentinel — Fragrance Intelligence App

## Architecture

**Monorepo** (pnpm workspace) with two artifacts:

| Artifact | Directory | Preview Path | Port |
|---|---|---|---|
| API Server | `artifacts/api-server` | `/api` | 8080 |
| Scentinel Web | `artifacts/scentinel` | `/` | 25575 |

**Shared libraries:**
- `lib/db` — Drizzle ORM + PostgreSQL schema (auth sessions, user profiles)
- `lib/api-spec` — OpenAPI spec + Orval codegen
- `lib/api-client-react` — Generated React Query hooks
- `lib/api-zod` — Generated Zod validation schemas
- `lib/replit-auth-web` — Browser auth hook (`useAuth()`)
- `lib/integrations-anthropic-ai` — Anthropic AI client via Replit AI Integrations

## Features

- **Search** — Fuzzy fragrance search via Fuse.js (GET /api/search?q=)
- **Dupe Finder** — Cosine similarity on accord vectors (POST /api/dupes)
- **Context Recommendations** — Scored picks by weather/occasion/time (POST /api/context)
- **Blind Buy Scorer** — Claude-powered AI scoring with breakdown + risk flags (POST /api/score)
- **Live Weather** — OpenWeatherMap proxy (GET /api/weather)
- **User Profiles** — Owned fragrance collection + budget, persisted in PostgreSQL (GET/PUT /api/profile)
- **Auth** — Replit OIDC via openid-client v6
- **Onboarding** — 3-step modal on first visit

## Fragrance Data

12 seed fragrances in `artifacts/api-server/data/fragrance-data.json`:
Creed Aventus, Dior Sauvage EDP, Bleu de Chanel EDP, Tom Ford Oud Wood, YSL Y EDP, Parfums de Marly Layton, Amouage Jubilation XXV, Armaf Club de Nuit Intense Man, Acqua di Gio Profondo, Paco Rabanne Invictus Platinum, Jo Malone Wood Sage & Sea Salt, Maison Margiela Replica Jazz Club.

## Environment Secrets

| Secret | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection (Replit managed) |
| `SESSION_SECRET` | Express session signing |
| `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` | Replit AI proxy for Claude |
| `AI_INTEGRATIONS_ANTHROPIC_API_KEY` | Replit AI proxy key (dummy value) |
| `OPENWEATHER_KEY` | OpenWeatherMap free API key |

## Styling

Dark luxury theme:
- Background: `#090807` (`hsl(30 14% 3%)`)
- Card surface: `#181511` (`hsl(34 17% 8%)`)
- Gold accent: `#c49a3c` (`hsl(42 54% 50%)`)
- Fonts: Cormorant Garamond (serif/headings), DM Mono (scores/prices), DM Sans (body)

## Database Schema

- `sessions` — Auth session store (from replit-auth)
- `users` — Authenticated user records
- `user_profiles` — Owned fragrances (JSONB) + budget string

## API Routes

All routes served under `/api`:

| Method | Path | Description |
|---|---|---|
| GET | `/healthz` | Health check |
| GET | `/auth/user` | Current auth user |
| GET | `/login` | Start OIDC login |
| GET | `/callback` | OIDC callback |
| GET | `/logout` | Clear session |
| GET | `/search?q=` | Fuzzy fragrance search |
| POST | `/dupes` | Find accord-similar fragrances |
| POST | `/context` | Context-aware picks |
| POST | `/score` | AI blind buy score |
| GET | `/weather?lat=&lon=` | Weather proxy |
| GET | `/profile` | Get user profile |
| PUT | `/profile` | Save user profile |

## Development

Run workflows via Replit — do not run `pnpm dev` at the workspace root.

To regenerate API client after spec changes:
```
pnpm --filter @workspace/api-spec run codegen
```

To push DB schema changes:
```
pnpm --filter @workspace/db run push
```
