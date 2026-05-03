import { Router } from "express";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Fuse from "fuse.js";
import { sql, ilike, or, eq } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { getAuth } from "@clerk/express";
import { db, aiFragrancesTable, fragrancesTable, userProfilesTable } from "@workspace/db";
import type { CachedFragrance } from "@workspace/db";
import {
  SearchFragrancesQueryParams,
  FindDupesBody,
  GetContextRecommendationsBody,
  GetBlindBuyScoreBody,
} from "@workspace/api-zod";
import { makeHash, getCached, setCached, evictExpired } from "../lib/ai-cache.js";
import { aiRateLimit } from "../middlewares/rateLimiter.js";
import { computeScentDNA } from "../lib/scent-dna.js";
import { logger } from "../lib/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface FragranceNotes {
  top: string[];
  heart: string[];
  base: string[];
}

interface Fragrance {
  id: string;
  name: string;
  house: string;
  year: number;
  concentration: string;
  accords: string[];
  notes: FragranceNotes;
  longevity: number;
  sillage: number;
  price_usd: number;
  image_url?: string;
}

const fragrancesPath = join(__dirname, "../data/fragrance-data.json");
const fragrances: Fragrance[] = JSON.parse(readFileSync(fragrancesPath, "utf-8"));

interface DuaEntry {
  name: string;
  link: string;
  inspiredBy: string;
  notes: string;
}
const duaPath = join(__dirname, "../data/dua-data.json");
const duaEntries: DuaEntry[] = JSON.parse(readFileSync(duaPath, "utf-8"));

function findDuaClones(fragranceName: string, house: string): DuaEntry[] {
  const target = `${house} ${fragranceName}`.toLowerCase();
  const nameOnly = fragranceName.toLowerCase();
  return duaEntries.filter((e) => {
    const inspired = e.inspiredBy.toLowerCase();
    return inspired.includes(target) || inspired.includes(nameOnly);
  });
}

const fuse = new Fuse(fragrances, {
  keys: ["name", "house"],
  threshold: 0.4,
  includeScore: true,
});

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  const dot = vecA.reduce((sum, a, i) => sum + a * (vecB[i] ?? 0), 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

function buildAccordVector(fragrance: Fragrance, allAccords: string[]): number[] {
  return allAccords.map((accord) => (fragrance.accords.includes(accord) ? 1 : 0));
}

const allAccords = [
  "fruity", "woody", "smoky", "fresh", "citrus", "spicy", "lavender", "vanilla",
  "aromatic", "aquatic", "mineral", "earthy", "oud", "resinous", "sweet", "fougere",
  "oriental", "floral", "amber",
];

// ─── T006: Stale TTL ──────────────────────────────────────────────────────────
const FRAG_STALE_MS = 30 * 24 * 60 * 60 * 1000;
function isFragStale(createdAt: Date): boolean {
  return Date.now() - createdAt.getTime() > FRAG_STALE_MS;
}

// ─── T003: Seed fragrances from JSON → DB on startup ─────────────────────────
async function seedFragrancesDB(): Promise<void> {
  try {
    const [existing] = await db
      .select({ id: fragrancesTable.id })
      .from(fragrancesTable)
      .limit(1);
    if (existing) return;
    await db
      .insert(fragrancesTable)
      .values(
        fragrances.map((f) => ({
          id: f.id,
          name: f.name,
          house: f.house,
          year: f.year,
          concentration: f.concentration,
          accords: f.accords,
          notes: f.notes,
          longevity: f.longevity,
          sillage: f.sillage,
          priceUsd: f.price_usd,
          imageUrl: f.image_url ?? null,
          source: "seed",
        })),
      )
      .onConflictDoNothing();
    logger.info({ count: fragrances.length }, "Seeded fragrances to DB");
  } catch (err) {
    logger.warn({ err }, "Failed to seed fragrances to DB — continuing without");
  }
}
seedFragrancesDB();

// ─── T004: Evict expired AI cache entries every hour ─────────────────────────
setInterval(() => evictExpired(), 60 * 60 * 1000);

// ─── AI generation ────────────────────────────────────────────────────────────
const AI_SYSTEM_PROMPT = `You are a fragrance database expert with encyclopedic knowledge of perfumery. Given a search query, identify the fragrance and return complete, accurate structured data.

Return ONLY valid JSON in this exact structure, or the literal string "null" if the query is not a recognisable fragrance:
{
  "id": "<house-name-as-kebab-slug>",
  "name": "<fragrance name only, no house>",
  "house": "<brand/house name>",
  "year": <integer year of release>,
  "concentration": "<EDP|EDT|Parfum|EDC>",
  "accords": ["<accord>", ...],
  "notes": {
    "top": ["<note>", ...],
    "heart": ["<note>", ...],
    "base": ["<note>", ...]
  },
  "longevity": <1-5>,
  "sillage": <1-5>,
  "price_usd": <typical US 100ml retail price as integer>,
  "image_url": "<reliable CDN URL if you know it with certainty, otherwise null>"
}

Valid accords (use only these): fruity, woody, smoky, fresh, citrus, spicy, lavender, vanilla, aromatic, aquatic, mineral, earthy, oud, resinous, sweet, fougere, oriental, floral, amber
Longevity/sillage scale: 1=poor, 2=weak, 3=moderate, 4=long/strong, 5=extreme/enormous
Prices should be in USD. Only include image_url if you are highly confident the URL is real and current — do not guess.`;

async function generateFragranceProfile(
  query: string,
  log: (msg: string) => void,
): Promise<Fragrance | null> {
  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: AI_SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Search query: "${query}"` }],
    });

    const content = message.content[0];
    if (content.type !== "text") return null;

    const raw = content.text.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "");
    if (raw === "null" || raw === "") return null;

    const parsed = JSON.parse(raw) as Fragrance;
    if (!parsed.id || !parsed.name || !parsed.house) return null;

    if (
      parsed.image_url &&
      (parsed.image_url.includes("example.com") || parsed.image_url.length < 20)
    ) {
      parsed.image_url = undefined;
    }

    try {
      await db
        .insert(aiFragrancesTable)
        .values({ id: parsed.id, searchQuery: query.toLowerCase(), data: parsed })
        .onConflictDoUpdate({
          target: aiFragrancesTable.id,
          set: { data: parsed, searchQuery: query.toLowerCase(), createdAt: new Date() },
        });
    } catch (dbErr) {
      log(`DB insert failed for AI fragrance: ${dbErr}`);
    }

    return parsed;
  } catch (err) {
    log(`AI fragrance generation failed: ${err}`);
    return null;
  }
}

// ─── T006: Cache lookup with staleness refresh ────────────────────────────────
async function findFragranceInDB(
  name: string,
  log: (msg: string) => void,
): Promise<Fragrance | null> {
  try {
    const cached = await db
      .select()
      .from(aiFragrancesTable)
      .where(
        or(
          ilike(sql`${aiFragrancesTable.data}->>'name'`, name),
          ilike(
            sql`${aiFragrancesTable.data}->>'house' || ' ' || ${aiFragrancesTable.data}->>'name'`,
            name,
          ),
        ),
      )
      .limit(1);

    if (cached[0]) {
      if (isFragStale(cached[0].createdAt)) {
        generateFragranceProfile(name, log).catch(() => {});
      }
      return cached[0].data as Fragrance;
    }
  } catch { /* ignore */ }
  return null;
}

const router = Router();

// ─── GET /search ──────────────────────────────────────────────────────────────
router.get("/search", async (req, res) => {
  const parsed = SearchFragrancesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid query parameter q" });
    return;
  }
  const { q } = parsed.data;

  const localResults = fuse.search(q).slice(0, 10).map((r) => r.item);
  if (localResults.length > 0) {
    res.json(localResults);
    return;
  }

  try {
    const cached = await db
      .select()
      .from(aiFragrancesTable)
      .where(
        or(
          ilike(sql`${aiFragrancesTable.data}->>'name'`, `%${q}%`),
          ilike(sql`${aiFragrancesTable.data}->>'house'`, `%${q}%`),
          ilike(aiFragrancesTable.searchQuery, `%${q}%`),
        ),
      )
      .limit(5);

    if (cached.length > 0) {
      // T006: background refresh any stale entries
      for (const row of cached) {
        if (isFragStale(row.createdAt)) {
          generateFragranceProfile(row.searchQuery, (msg) => req.log.warn(msg)).catch(() => {});
        }
      }
      res.json(cached.map((r) => r.data));
      return;
    }
  } catch (dbErr) {
    req.log.warn({ err: dbErr }, "DB cache check failed, falling through to AI");
  }

  req.log.info({ q }, "No local results; generating fragrance profile with AI");
  const generated = await generateFragranceProfile(q, (msg) => req.log.warn(msg));
  res.json(generated ? [generated] : []);
});

// ─── POST /dupes ──────────────────────────────────────────────────────────────
router.post("/dupes", async (req, res) => {
  const parsed = FindDupesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { fragranceName, priceCeiling } = parsed.data;

  let target: Fragrance | undefined = fragrances.find(
    (f) =>
      f.name.toLowerCase() === fragranceName.toLowerCase() ||
      `${f.house} ${f.name}`.toLowerCase() === fragranceName.toLowerCase(),
  );

  if (!target) {
    const fromDB = await findFragranceInDB(fragranceName, (msg) => req.log.warn(msg));
    if (fromDB) target = fromDB;
  }

  if (!target) {
    res.status(404).json({ error: `Fragrance not found: ${fragranceName}` });
    return;
  }

  const targetVec = buildAccordVector(target, allAccords);

  const results = fragrances
    .filter((f) => f.id !== target!.id)
    .filter((f) => priceCeiling == null || f.price_usd <= priceCeiling)
    .map((f) => {
      const vec = buildAccordVector(f, allAccords);
      const sim = cosineSimilarity(targetVec, vec);
      return {
        name: f.name,
        house: f.house,
        similarity_pct: Math.round(sim * 100),
        price_usd: f.price_usd,
        price_delta: target!.price_usd - f.price_usd,
        accords: f.accords,
        buy_link: undefined as string | undefined,
        is_dua: false,
      };
    })
    .sort((a, b) => b.similarity_pct - a.similarity_pct)
    .slice(0, 5);

  const duaClones = findDuaClones(target.name, target.house);
  const duaResults = duaClones.slice(0, 2).map((clone) => ({
    name: clone.name,
    house: "Dua Fragrances",
    similarity_pct: 92,
    price_usd: 35,
    price_delta: target!.price_usd - 35,
    accords: target!.accords,
    buy_link: clone.link,
    is_dua: true,
  }));

  const merged = [...duaResults, ...results].slice(0, 6);
  res.json(merged);
});

// ─── POST /context ────────────────────────────────────────────────────────────
router.post("/context", async (req, res) => {
  const parsed = GetContextRecommendationsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { weatherTemp, occasion, timeOfDay, ownedFragrances } = parsed.data;

  const candidates = fragrances.filter((f) =>
    ownedFragrances.some(
      (owned) =>
        f.name.toLowerCase() === owned.toLowerCase() ||
        `${f.house} ${f.name}`.toLowerCase() === owned.toLowerCase(),
    ),
  );

  const scored = candidates.map((f) => {
    let score = 50;

    if (occasion?.toLowerCase().includes("office")) {
      if (f.longevity >= 2 && f.longevity <= 3) score += 15;
      if (f.sillage <= 2) score += 15;
    } else if (
      occasion?.toLowerCase().includes("date") ||
      occasion?.toLowerCase().includes("evening")
    ) {
      if (f.sillage >= 3) score += 15;
      if (f.accords.some((a) => ["oriental", "oud", "woody", "spicy"].includes(a))) score += 10;
    } else if (
      occasion?.toLowerCase().includes("casual") ||
      occasion?.toLowerCase().includes("outdoor")
    ) {
      if (f.accords.some((a) => ["fresh", "citrus", "aquatic"].includes(a))) score += 15;
    }

    const temp = weatherTemp ?? 15;
    if (temp > 22) {
      if (f.accords.some((a) => ["fresh", "citrus", "aquatic"].includes(a))) score += 20;
      if (f.longevity <= 3) score += 5;
    } else if (temp < 12) {
      if (f.accords.some((a) => ["woody", "spicy", "oud", "oriental"].includes(a))) score += 20;
      if (f.longevity >= 4) score += 5;
    } else {
      score += 10;
    }

    if (timeOfDay?.toLowerCase().includes("morning")) {
      if (f.accords.some((a) => ["fresh", "citrus", "aromatic"].includes(a))) score += 15;
    } else if (
      timeOfDay?.toLowerCase().includes("evening") ||
      timeOfDay?.toLowerCase().includes("night")
    ) {
      if (f.accords.some((a) => ["oriental", "woody", "oud", "smoky"].includes(a))) score += 15;
    }

    const reasons: string[] = [];
    if (temp > 22 && f.accords.some((a) => ["fresh", "citrus"].includes(a)))
      reasons.push("great for warm weather");
    if (temp < 12 && f.accords.some((a) => ["woody", "spicy"].includes(a)))
      reasons.push("perfect for cold conditions");
    if (occasion?.toLowerCase().includes("office") && f.sillage <= 2)
      reasons.push("subtle enough for the office");
    if (
      timeOfDay?.toLowerCase().includes("evening") &&
      f.accords.some((a) => ["woody", "oud"].includes(a))
    )
      reasons.push("ideal for evening wear");

    return {
      fragrance: f,
      score,
      reason: reasons.length > 0 ? reasons.join(", ") : "solid all-rounder for this context",
    };
  });

  const top3 = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item, index) => ({
      rank: index + 1,
      name: item.fragrance.name,
      house: item.fragrance.house,
      reason: item.reason.charAt(0).toUpperCase() + item.reason.slice(1),
      match_pct: Math.min(100, item.score),
    }));

  res.json(top3);
});

// ─── POST /score (T004 cache + T005 rate limit) ───────────────────────────────
router.post("/score", aiRateLimit, async (req, res) => {
  const parsed = GetBlindBuyScoreBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { fragranceName, ownedFragrances, budget } = parsed.data;

  let target: Fragrance | undefined = fragrances.find(
    (f) =>
      f.name.toLowerCase() === fragranceName.toLowerCase() ||
      `${f.house} ${f.name}`.toLowerCase() === fragranceName.toLowerCase(),
  );

  if (!target) {
    const fromDB = await findFragranceInDB(fragranceName, (msg) => req.log.warn(msg));
    if (fromDB) target = fromDB;
  }

  if (!target) {
    res.status(404).json({ error: `Fragrance not found: ${fragranceName}` });
    return;
  }

  // T004: Check response cache (7-day TTL for stable scores)
  const cachePayload = {
    f: fragranceName.toLowerCase(),
    o: [...(ownedFragrances ?? [])].sort(),
    b: budget ?? null,
  };
  const cacheKey = makeHash("score", cachePayload);
  const cached = await getCached(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  const ownedDetails = fragrances
    .filter((f) =>
      ownedFragrances?.some(
        (owned) =>
          f.name.toLowerCase() === owned.toLowerCase() ||
          `${f.house} ${f.name}`.toLowerCase() === owned.toLowerCase(),
      ),
    )
    .map((f) => `${f.house} ${f.name} (accords: ${f.accords.join(", ")})`);

  const systemPrompt = `You are a world-class fragrance expert with deep knowledge of perfumery, accord chemistry, batch variation, longevity performance, and community reception. You give precise, honest, actionable blind buy recommendations based on objective fragrance data.

When evaluating a fragrance for a blind buy, you consider:
- Accord compatibility with the user's existing collection (avoid blind-buying what they already own)
- Community-reported longevity reliability (some fragrances have batch variation)
- Batch consistency issues (particularly relevant for niche houses and certain designer releases)
- Price-to-quality value versus alternatives
- Risk flags specific to this fragrance's reputation

Always respond with ONLY valid JSON, no markdown or explanation.`;

  const userPrompt = `Evaluate this fragrance for a blind buy:

Fragrance: ${target.house} ${target.name}
Concentration: ${target.concentration}
Year: ${target.year}
Price: $${target.price_usd}
Accords: ${target.accords.join(", ")}
Top Notes: ${target.notes.top.join(", ")}
Heart Notes: ${target.notes.heart.join(", ")}
Base Notes: ${target.notes.base.join(", ")}
Longevity (1-5): ${target.longevity}
Sillage (1-5): ${target.sillage}
${budget ? `User Budget: $${budget}` : ""}
${ownedDetails.length > 0 ? `User's Collection:\n${ownedDetails.join("\n")}` : "User has no collection data."}

Respond with ONLY this JSON structure:
{
  "overall_score": <number 0-100>,
  "breakdown": {
    "accord_compatibility": <number 0-100>,
    "community_longevity": <number 0-100>,
    "batch_consistency": <number 0-100>,
    "price_value": <number 0-100>
  },
  "verdict": <"Strong buy" | "Buy" | "Try first" | "Avoid">,
  "risk_flags": [
    { "level": <"warn" | "info" | "ok">, "message": "<specific, actionable flag>" }
  ],
  "recommendation": "<2-3 sentence expert recommendation>"
}`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      res.status(500).json({ error: "Unexpected response type from AI" });
      return;
    }

    const jsonText = content.text.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "");
    const scoreData = JSON.parse(jsonText);

    // T004: Cache for 7 days
    await setCached(cacheKey, "score", cachePayload, scoreData, 7 * 24);

    res.json(scoreData);
  } catch (err) {
    req.log.error({ err }, "Failed to get blind buy score from Claude");
    res.status(500).json({ error: "Failed to generate blind buy score" });
  }
});

// ─── POST /semantic-search (T004 cache + T005 rate limit + T007 scent DNA) ───
router.post("/semantic-search", aiRateLimit, async (req, res) => {
  const { query } = req.body as { query: string };
  if (!query?.trim()) {
    res.status(400).json({ error: "query required" });
    return;
  }

  // T007: Get user's scent DNA to personalise the interpretation
  const { userId } = getAuth(req);
  let scentContext = "";
  if (userId) {
    try {
      const [userProfile] = await db
        .select()
        .from(userProfilesTable)
        .where(eq(userProfilesTable.userId, userId))
        .limit(1);
      if (userProfile?.ownedFragrances.length) {
        const dna = computeScentDNA(userProfile.ownedFragrances, fragrances);
        if (dna) {
          scentContext = ` This user's collection suggests a preference for ${dna.topAccords.slice(0, 3).join(", ")} accords with ${dna.intensity} intensity. Lean toward options that complement rather than duplicate their existing taste.`;
        }
      }
    } catch { /* non-fatal */ }
  }

  // T004: Cache AI profile interpretation (query-specific, 24h TTL)
  const profileCacheKey = makeHash("semantic-profile", { q: query.toLowerCase().trim() });
  let profile = (await getCached(profileCacheKey)) as {
    interpretation: string;
    target_accords: string[];
    avoid_accords: string[];
    longevity_min: number;
    intensity: string;
  } | null;

  if (!profile) {
    try {
      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 512,
        system: `You are a fragrance expert.${scentContext} Interpret a natural language fragrance vibe and extract structured accord parameters. Respond ONLY with valid JSON, no markdown.`,
        messages: [
          {
            role: "user",
            content: `Interpret: "${query}"

You MUST only use accords from this exact list: fruity, woody, smoky, fresh, citrus, spicy, lavender, vanilla, aromatic, aquatic, mineral, earthy, oud, resinous, sweet, fougere, oriental, floral, amber

Do NOT invent new accord names. Map everything to the closest accord from the list above.

Return JSON:
{
  "interpretation": "1-2 sentence description of what the user seeks",
  "target_accords": ["up to 6 accords from the list above only"],
  "avoid_accords": ["up to 3 accords from the list above that clash with this vibe"],
  "longevity_min": 1,
  "intensity": "light|moderate|strong"
}`,
          },
        ],
      });

      const content = msg.content[0];
      if (content.type !== "text") throw new Error("unexpected response");
      const raw = content.text.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "");
      profile = JSON.parse(raw);

      // T004: Cache interpretation for 24h
      await setCached(
        profileCacheKey,
        "semantic-profile",
        { q: query.toLowerCase().trim() },
        profile,
        24,
      );
    } catch (err) {
      req.log.error({ err }, "Semantic search AI failed");
      res.status(500).json({ error: "Failed to interpret query" });
      return;
    }
  }

  const targetAccords: string[] = profile!.target_accords ?? [];
  const avoidAccords: string[] = profile!.avoid_accords ?? [];

  const scored = fragrances.map((f) => {
    const matched = f.accords.filter((a) => targetAccords.includes(a));
    const avoided = f.accords.filter((a) => avoidAccords.includes(a));

    let score = 0;
    if (targetAccords.length > 0) score += (matched.length / targetAccords.length) * 78;
    score -= avoided.length * 20;
    if (f.longevity >= (profile!.longevity_min ?? 1)) score += 8;
    if (profile!.intensity === "strong" && f.sillage >= 3) score += 10;
    if (profile!.intensity === "light" && f.sillage <= 2) score += 10;
    if (profile!.intensity === "moderate" && f.sillage >= 2 && f.sillage <= 3) score += 8;

    score = Math.max(0, Math.min(100, Math.round(score)));

    const reason =
      matched.length > 0
        ? `Shares ${matched.slice(0, 3).join(", ")} accord${matched.length > 1 ? "s" : ""} with your vibe`
        : "Partial mood match";

    return { ...f, match_score: score, match_reason: reason };
  });

  const results = scored
    .filter((f) => f.match_score > 15)
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, 9);

  res.json({ interpretation: profile!.interpretation, accords: targetAccords, results });
});

// ─── POST /similar ────────────────────────────────────────────────────────────
router.post("/similar", async (req, res) => {
  const { fragranceName } = req.body as { fragranceName?: string };
  if (!fragranceName?.trim()) {
    res.status(400).json({ error: "fragranceName required" });
    return;
  }

  let target: Fragrance | undefined = fragrances.find(
    (f) =>
      f.name.toLowerCase() === fragranceName.toLowerCase() ||
      `${f.house} ${f.name}`.toLowerCase() === fragranceName.toLowerCase(),
  );

  if (!target) {
    const fromDB = await findFragranceInDB(fragranceName, (msg) => req.log.warn(msg));
    if (fromDB) target = fromDB;
  }

  if (!target) {
    res.status(404).json({ error: `Fragrance not found: ${fragranceName}` });
    return;
  }

  const targetVec = buildAccordVector(target, allAccords);

  const results = fragrances
    .filter((f) => f.id !== target!.id)
    .map((f) => {
      const vec = buildAccordVector(f, allAccords);
      const sim = cosineSimilarity(targetVec, vec);
      const sharedAccords = f.accords.filter((a) => target!.accords.includes(a));
      return {
        id: f.id,
        name: f.name,
        house: f.house,
        similarity_pct: Math.round(sim * 100),
        price_usd: f.price_usd,
        concentration: f.concentration,
        accords: f.accords,
        shared_accords: sharedAccords,
        longevity: f.longevity,
        sillage: f.sillage,
      };
    })
    .filter((f) => f.similarity_pct > 20)
    .sort((a, b) => b.similarity_pct - a.similarity_pct)
    .slice(0, 8);

  res.json(results);
});

// ─── POST /community (T004 cache + T005 rate limit) ──────────────────────────
router.post("/community", aiRateLimit, async (req, res) => {
  const { fragranceName } = req.body as { fragranceName?: string };
  if (!fragranceName?.trim()) {
    res.status(400).json({ error: "fragranceName required" });
    return;
  }

  // T004: Check cache (48h TTL — community opinions change slowly)
  const cacheKey = makeHash("community", { fn: fragranceName.toLowerCase().trim() });
  const cached = await getCached(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system:
        "You are a fragrance community expert with comprehensive knowledge of r/fragrance discussions, common opinions, batch variation reports, and community consensus on popular fragrances.",
      messages: [
        {
          role: "user",
          content: `Summarise what the r/fragrance community says about "${fragranceName}" in exactly 4 bullet points.

Cover these angles: overall reception & consensus, real-world longevity/projection reports from users, any reformulation or batch consistency concerns, and value vs. alternatives.

Format: one bullet per line starting with "•". Be specific, opinionated, and realistic — no generic filler. If the fragrance is obscure or little discussed, say so honestly.`,
        },
      ],
    });

    const content = msg.content[0];
    const text = content.type === "text" ? content.text.trim() : "";
    const bullets = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("•"))
      .map((l) => l.replace(/^•\s*/, ""));

    const result = { summary: text, bullets };

    // T004: Cache for 48h
    await setCached(
      cacheKey,
      "community",
      { fn: fragranceName.toLowerCase().trim() },
      result,
      48,
    );

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Community sentiment generation failed");
    res.status(500).json({ error: "Failed to generate community sentiment" });
  }
});

export default router;
