# Scentinel — Fragrance Intelligence App

## Architecture

**Monorepo** (pnpm workspace) with two artifacts:

| Artifact | Directory | Preview Path | Port |
|---|---|---|---|
| API Server | `artifacts/api-server` | `/api` | 8080 |
| Scentinel Web | `artifacts/scentinel` | `/` | 25575 |

**Shared libraries:**
- `lib/db` — Drizzle ORM + PostgreSQL schema (user profiles, ai_fragrances cache)
- `lib/api-spec` — OpenAPI spec + Orval codegen
- `lib/api-client-react` — Generated React Query hooks
- `lib/api-zod` — Generated Zod validation schemas
- `lib/integrations-anthropic-ai` — Anthropic AI client via Replit AI Integrations

## Features

- **Chat** — Conversational AI assistant powered by Claude with tool_use; handles dupes, blind buy scoring, context picks, and fragrance lookups via natural language (POST /api/chat)
- **Search** — Fuzzy fragrance search via Fuse.js (GET /api/search?q=)
- **Semantic/NL Search** — "Discover" view: Claude interprets natural language vibe descriptions → extracts accord profile → cosine-ranks 232 fragrances → returns top 9 matches with reasons (POST /api/semantic-search)
- **Dupe Finder** — Cosine similarity on accord vectors (POST /api/dupes)
- **Context Recommendations** — Scored picks by weather/occasion/time (POST /api/context)
- **Blind Buy Scorer** — Claude-powered AI scoring with breakdown + risk flags (POST /api/score)
- **Live Weather** — OpenWeatherMap proxy (GET /api/weather)
- **User Profiles** — Owned fragrance collection + budget, persisted in PostgreSQL (GET/PUT /api/profile)
- **Wishlist** — localStorage-based wishlist with add/remove, personal notes per fragrance, bookmark button on every fragrance hero card
- **Auth** — Clerk (email + Google) with dark luxury branded sign-in/sign-up pages at `/sign-in` and `/sign-up`
- **Onboarding** — 3-step modal on first visit

## Visual Components

- **FragranceHero** — Redesigned with layered sections: image/placeholder | accord pills | visual fragrance pyramid (3 trapezoid tiers with note icons) | longevity/sillage bars + bookmark button
- **BottlePlaceholder** — SVG perfume bottle silhouette shown when no image URL is available
- **SemanticSearchView** — Full discover page: text input, curated example queries, interpretation card, accord pills, result grid
- **WishlistPage** — Grid of saved fragrances with personal note editing, added date, and remove button

## Fragrance Data

**44 seed fragrances** in `artifacts/api-server/data/fragrance-data.json` covering designer, niche, and budget:
Creed (Aventus, Green Irish Tweed, Silver Mountain Water), Dior (Sauvage EDP, Miss Dior), Chanel (Bleu EDP, No 5, Coco Mademoiselle, Chance Eau Tendre), Tom Ford (Oud Wood, Tobacco Vanille, Tuscan Leather, Black Orchid), YSL (Y EDP, Libre), Parfums de Marly (Layton, Percival, Godolphin), Amouage (Jubilation XXV), MFK (Baccarat Rouge 540), Initio (Oud for Greatness, Side Effect), Xerjoff (Naxos), Armaf (CDNI), Giorgio Armani (AdG EDT, AdG Profondo), Paco Rabanne (Invictus Platinum, 1 Million), Versace (Eros), D&G (The One), Jean Paul Gaultier (Le Male), Montblanc (Explorer), Burberry (Hero), Givenchy (Gentleman Boisée), Lancôme (La Vie est Belle), Viktor & Rolf (Spicebomb Extreme), Thierry Mugler (A*Men), Davidoff (Cool Water), Azzaro (Chrome), Byredo (Bal d'Afrique), Le Labo (Santal 33), Memo Paris (Irish Leather), Jo Malone (Wood Sage & Sea Salt), Maison Margiela (Replica Jazz Club).

**AI-powered dynamic lookup**: When a search query finds no local matches, Claude generates a complete fragrance profile (notes, accords, longevity, sillage, price, image_url) on demand and caches it in the `ai_fragrances` PostgreSQL table. This gives effectively unlimited fragrance coverage.

Image URLs use official brand CDNs (Dior, Chanel, Tom Ford, YSL, Jo Malone) and high-quality retailer CDNs (myperfumeshop.com, microperfumes.com, fragrancex.com).

## Environment Secrets

| Secret | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection (Replit managed) |
| `CLERK_SECRET_KEY` | Clerk backend secret key |
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key (server-side ref) |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key exposed to Vite frontend |
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

- `user_profiles` — Owned fragrances (JSONB) + budget string, keyed by Clerk userId
- `ai_fragrances` — AI-generated fragrance cache

## API Routes

All routes served under `/api`:

| Method | Path | Description |
|---|---|---|
| GET | `/healthz` | Health check |
| GET | `/auth/user` | Current auth user (Clerk userId) |
| GET | `/search?q=` | Fuzzy fragrance search |
| POST | `/dupes` | Find accord-similar fragrances |
| POST | `/context` | Context-aware picks |
| POST | `/score` | AI blind buy score |
| POST | `/chat` | Conversational AI with Claude tool_use |
| POST | `/semantic-search` | NL vibe → Claude accord extraction → cosine-ranked results |
| POST | `/mcp` | MCP Streamable HTTP — initialize / tool calls |
| GET | `/mcp` | MCP SSE stream (server → client) |
| DELETE | `/mcp` | MCP session teardown |
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
