# Scentinel — Fragrance Intelligence App

## Architecture

**Monorepo** (pnpm workspace) with two artifacts:

| Artifact | Directory | Preview Path | Port |
|---|---|---|---|
| API Server | `artifacts/api-server` | `/api` | 8080 |
| Scentinel Web | `artifacts/scentinel` | `/` | 25575 |

**Shared libraries:**
- `lib/db` — Drizzle ORM + PostgreSQL schema
- `lib/api-spec` — OpenAPI spec + Orval codegen
- `lib/api-client-react` — Generated React Query hooks
- `lib/api-zod` — Generated Zod validation schemas
- `lib/integrations-anthropic-ai` — Anthropic AI client via Replit AI Integrations

## Features

- **Chat** — Claude-powered conversational AI with tool_use; handles dupes, blind buy scoring, context picks, and fragrance lookups via natural language. Chat history is persisted per-user in PostgreSQL (`chat_sessions` table) and restored on next visit. Scent DNA from user collection is injected into the system prompt (POST /api/chat)
- **Chat Sessions** — GET/POST/PATCH/DELETE /api/chat-sessions; frontend useChatSessions hook auto-loads latest session and saves after every exchange
- **Search** — Fuzzy fragrance search via Fuse.js (GET /api/search?q=)
- **Semantic/NL Search** — "Discover" view: Claude interprets natural language vibe descriptions → extracts accord profile (cached 24h) → cosine-ranks 232 fragrances → top 9 results. User scent DNA injected to personalise the Claude prompt (POST /api/semantic-search)
- **Dupe Finder** — Cosine similarity on accord vectors + Dua Fragrances clones (POST /api/dupes)
- **Context Recommendations** — Scored picks by weather/occasion/time (POST /api/context)
- **Blind Buy Scorer** — Claude-powered AI scoring cached for 7 days; breakdown + risk flags (POST /api/score)
- **Community Sentiment** — Claude-synthesised r/fragrance opinions, cached 48h (POST /api/community)
- **Live Weather** — OpenWeatherMap proxy (GET /api/weather)
- **User Profiles** — Owned fragrance collection + budget, persisted in PostgreSQL (GET/PUT /api/profile)
- **Scent DNA** — Inferred accord preferences from collection; exposed at GET /api/profile/scent-dna and injected into /chat and /semantic-search AI prompts
- **Wishlist** — DB-backed for signed-in users (GET/POST/DELETE/PATCH /api/wishlist), localStorage fallback for guests
- **Auth** — Clerk (email + Google) with dark luxury branded sign-in/sign-up pages
- **Onboarding** — 3-step modal on first visit
- **MCP** — Streamable HTTP + SSE MCP endpoint (POST/GET/DELETE /api/mcp)

## Visual Components

- **FragranceHero** — Layered sections: image/placeholder | accord pills | fragrance pyramid | longevity/sillage bars + bookmark button
- **BottlePlaceholder** — SVG perfume bottle silhouette for missing images
- **SemanticSearchView** — Full discover page with curated example queries, interpretation card, accord pills, result grid
- **WishlistPage** — Grid of saved fragrances with personal notes, added date, remove button
- **ChatPage** — Conversational UI with session restore, New Chat button, quick-suggestion chips, rich ToolResult cards (DupeCards, ScoreCard, ContextPicksCard)

## Fragrance Data

**232 fragrances** seeded to `fragrances` PostgreSQL table on server startup from `artifacts/api-server/data/fragrance-data.json`. JSON is also kept in memory for fast Fuse.js fuzzy search and cosine similarity calculations.

**AI-powered dynamic lookup**: Unknown fragrances trigger Claude to generate a complete profile (notes, accords, longevity, sillage, price) cached in the `ai_fragrances` table. Stale entries (>30 days) trigger a silent background refresh while returning the cached data immediately.

## System Design Features

| Feature | Detail |
|---|---|
| **Wishlist → PostgreSQL** | DB for auth'd users, localStorage fallback for guests; real-time sync on sign-in |
| **Chat history persistence** | `chat_sessions` table; frontend loads latest session on mount, saves after every AI response |
| **Fragrance seed → DB** | 232 fragrances seeded to `fragrances` table on startup via `seedFragrancesDB()` |
| **AI response cache** | `ai_response_cache` table — semantic-search 24h, score 7 days, community 48h |
| **Rate limiting** | 15 AI requests/min per user/IP; in-memory sliding window (`aiRateLimit` middleware) |
| **ai_fragrances TTL** | 30-day stale check; background refresh on reads, stale data returned immediately |
| **Scent DNA injection** | Collection analysed for top accords/houses/price tier; injected into Claude prompts |

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
| `SESSION_SECRET` | Express session secret |

## Styling

Dark luxury theme:
- Background: `#090807` (`hsl(30 14% 3%)`)
- Card surface: `#181511` (`hsl(34 17% 8%)`)
- Gold accent: `#c49a3c` (`hsl(42 54% 50%)`)
- Fonts: Cormorant Garamond (serif/headings), DM Mono (scores/prices), DM Sans (body)

## Database Schema

| Table | Purpose |
|---|---|
| `user_profiles` | Owned fragrances (JSONB) + budget, keyed by Clerk userId |
| `ai_fragrances` | AI-generated fragrance profiles cache |
| `wishlists` | Per-user fragrance bookmarks with personal notes |
| `chat_sessions` | Persisted chat history per user (JSONB messages array) |
| `ai_response_cache` | Cached AI API responses (semantic-search, score, community) |
| `fragrances` | Seed + AI-discovered fragrances (canonical store) |

## API Routes

All routes served under `/api`:

| Method | Path | Description |
|---|---|---|
| GET | `/healthz` | Health check |
| GET | `/auth/user` | Current auth user |
| GET | `/search?q=` | Fuzzy fragrance search |
| POST | `/dupes` | Accord-similar dupes + Dua clones |
| POST | `/context` | Context-aware picks from collection |
| POST | `/score` | AI blind buy score (cached 7d) |
| POST | `/chat` | Conversational AI, session-persisted |
| POST | `/semantic-search` | NL vibe → ranked results (profile cached 24h) |
| POST | `/community` | r/fragrance community sentiment (cached 48h) |
| POST | `/similar` | Cosine-similar fragrances |
| POST/GET/DELETE | `/mcp` | MCP Streamable HTTP + SSE |
| GET | `/weather?lat=&lon=` | Weather proxy |
| GET | `/profile` | Get user profile |
| PUT | `/profile` | Save user profile |
| GET | `/profile/scent-dna` | Compute scent DNA from collection |
| GET/POST | `/wishlist` | List / add wishlist items |
| DELETE/PATCH | `/wishlist/:id` | Remove / update wishlist item |
| GET | `/chat-sessions` | List user's chat sessions |
| GET | `/chat-sessions/:id` | Get full session with messages |
| POST | `/chat-sessions` | Create new session |
| PATCH | `/chat-sessions/:id` | Update session messages/title |
| DELETE | `/chat-sessions/:id` | Delete session |

## Key Server Utilities

- `artifacts/api-server/src/lib/ai-cache.ts` — `makeHash`, `getCached`, `setCached`, `evictExpired`
- `artifacts/api-server/src/lib/scent-dna.ts` — `computeScentDNA` (accord frequency, house preference, price tier, intensity)
- `artifacts/api-server/src/lib/reddit.ts` — Live r/fragrance post fetching via Reddit API
- `artifacts/api-server/src/middlewares/rateLimiter.ts` — `aiRateLimit` (15 req/min sliding window)

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
