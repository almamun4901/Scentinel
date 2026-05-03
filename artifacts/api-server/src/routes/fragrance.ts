import { Router } from "express";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Fuse from "fuse.js";
import { sql, ilike, or } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db, aiFragrancesTable } from "@workspace/db";
import type { CachedFragrance } from "@workspace/db";
import {
  SearchFragrancesQueryParams,
  FindDupesBody,
  GetContextRecommendationsBody,
  GetBlindBuyScoreBody,
} from "@workspace/api-zod";

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

const fuse = new Fuse(fragrances, {
  keys: ["name", "house"],
  threshold: 0.4,
  includeScore: true,
});

// Cosine similarity between two accord vectors
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  const dot = vecA.reduce((sum, a, i) => sum + a * (vecB[i] ?? 0), 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

// Build accord vector across all known accords
function buildAccordVector(fragrance: Fragrance, allAccords: string[]): number[] {
  return allAccords.map((accord) => (fragrance.accords.includes(accord) ? 1 : 0));
}

const allAccords = [
  "fruity", "woody", "smoky", "fresh", "citrus", "spicy", "lavender", "vanilla",
  "aromatic", "aquatic", "mineral", "earthy", "oud", "resinous", "sweet", "fougere",
  "oriental", "floral", "amber",
];

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
  log: (msg: string) => void
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

    // Null out image_url if it looks suspicious
    if (parsed.image_url && (parsed.image_url.includes("example.com") || parsed.image_url.length < 20)) {
      parsed.image_url = undefined;
    }

    // Persist to DB cache
    try {
      await db
        .insert(aiFragrancesTable)
        .values({ id: parsed.id, searchQuery: query.toLowerCase(), data: parsed })
        .onConflictDoNothing();
    } catch (dbErr) {
      log(`DB insert failed for AI fragrance: ${dbErr}`);
    }

    return parsed;
  } catch (err) {
    log(`AI fragrance generation failed: ${err}`);
    return null;
  }
}

const router = Router();

// GET /search?q=
router.get("/search", async (req, res) => {
  const parsed = SearchFragrancesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid query parameter q" });
    return;
  }
  const { q } = parsed.data;

  // 1. Check local JSON with Fuse.js
  const localResults = fuse.search(q).slice(0, 10).map((r) => r.item);
  if (localResults.length > 0) {
    res.json(localResults);
    return;
  }

  // 2. Check PostgreSQL cache for previously generated fragrances
  try {
    const cached = await db
      .select()
      .from(aiFragrancesTable)
      .where(
        or(
          ilike(sql`${aiFragrancesTable.data}->>'name'`, `%${q}%`),
          ilike(sql`${aiFragrancesTable.data}->>'house'`, `%${q}%`),
          ilike(aiFragrancesTable.searchQuery, `%${q}%`)
        )
      )
      .limit(5);

    if (cached.length > 0) {
      res.json(cached.map((r) => r.data));
      return;
    }
  } catch (dbErr) {
    req.log.warn({ err: dbErr }, "DB cache check failed, falling through to AI");
  }

  // 3. AI fallback — generate with Claude and cache
  req.log.info({ q }, "No local results; generating fragrance profile with AI");
  const generated = await generateFragranceProfile(q, (msg) => req.log.warn(msg));

  if (generated) {
    res.json([generated]);
  } else {
    res.json([]);
  }
});

// POST /dupes
router.post("/dupes", async (req, res) => {
  const parsed = FindDupesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { fragranceName, priceCeiling } = parsed.data;

  // Check local + DB cache
  let target: Fragrance | undefined = fragrances.find(
    (f) =>
      f.name.toLowerCase() === fragranceName.toLowerCase() ||
      `${f.house} ${f.name}`.toLowerCase() === fragranceName.toLowerCase()
  );

  if (!target) {
    try {
      const cached = await db
        .select()
        .from(aiFragrancesTable)
        .where(
          or(
            ilike(sql`${aiFragrancesTable.data}->>'name'`, fragranceName),
            ilike(sql`${aiFragrancesTable.data}->>'house' || ' ' || ${aiFragrancesTable.data}->>'name'`, fragranceName)
          )
        )
        .limit(1);
      if (cached[0]) target = cached[0].data as Fragrance;
    } catch { /* ignore */ }
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
      };
    })
    .sort((a, b) => b.similarity_pct - a.similarity_pct)
    .slice(0, 5);

  res.json(results);
});

// POST /context
router.post("/context", (req, res) => {
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
        `${f.house} ${f.name}`.toLowerCase() === owned.toLowerCase()
    )
  );

  const scored = candidates.map((f) => {
    let score = 50;

    if (occasion?.toLowerCase().includes("office")) {
      if (f.longevity >= 2 && f.longevity <= 3) score += 15;
      if (f.sillage <= 2) score += 15;
    } else if (occasion?.toLowerCase().includes("date") || occasion?.toLowerCase().includes("evening")) {
      if (f.sillage >= 3) score += 15;
      if (f.accords.some((a) => ["oriental", "oud", "woody", "spicy"].includes(a))) score += 10;
    } else if (occasion?.toLowerCase().includes("casual") || occasion?.toLowerCase().includes("outdoor")) {
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
    } else if (timeOfDay?.toLowerCase().includes("evening") || timeOfDay?.toLowerCase().includes("night")) {
      if (f.accords.some((a) => ["oriental", "woody", "oud", "smoky"].includes(a))) score += 15;
    }

    const reasons: string[] = [];
    if (temp > 22 && f.accords.some((a) => ["fresh", "citrus"].includes(a)))
      reasons.push("great for warm weather");
    if (temp < 12 && f.accords.some((a) => ["woody", "spicy"].includes(a)))
      reasons.push("perfect for cold conditions");
    if (occasion?.toLowerCase().includes("office") && f.sillage <= 2)
      reasons.push("subtle enough for the office");
    if (timeOfDay?.toLowerCase().includes("evening") && f.accords.some((a) => ["woody", "oud"].includes(a)))
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

// POST /score
router.post("/score", async (req, res) => {
  const parsed = GetBlindBuyScoreBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { fragranceName, ownedFragrances, budget } = parsed.data;

  let target: Fragrance | undefined = fragrances.find(
    (f) =>
      f.name.toLowerCase() === fragranceName.toLowerCase() ||
      `${f.house} ${f.name}`.toLowerCase() === fragranceName.toLowerCase()
  );

  if (!target) {
    try {
      const cached = await db
        .select()
        .from(aiFragrancesTable)
        .where(
          or(
            ilike(sql`${aiFragrancesTable.data}->>'name'`, fragranceName),
            ilike(sql`${aiFragrancesTable.data}->>'house' || ' ' || ${aiFragrancesTable.data}->>'name'`, fragranceName)
          )
        )
        .limit(1);
      if (cached[0]) target = cached[0].data as Fragrance;
    } catch { /* ignore */ }
  }

  if (!target) {
    res.status(404).json({ error: `Fragrance not found: ${fragranceName}` });
    return;
  }

  const ownedDetails = fragrances
    .filter((f) =>
      ownedFragrances?.some(
        (owned) =>
          f.name.toLowerCase() === owned.toLowerCase() ||
          `${f.house} ${f.name}`.toLowerCase() === owned.toLowerCase()
      )
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
    res.json(scoreData);
  } catch (err) {
    req.log.error({ err }, "Failed to get blind buy score from Claude");
    res.status(500).json({ error: "Failed to generate blind buy score" });
  }
});

// POST /semantic-search  — natural language fragrance discovery
router.post("/semantic-search", async (req, res) => {
  const { query } = req.body as { query: string };
  if (!query?.trim()) {
    res.status(400).json({ error: "query required" });
    return;
  }

  let profile: {
    interpretation: string;
    target_accords: string[];
    avoid_accords: string[];
    longevity_min: number;
    intensity: string;
  };

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: "You are a fragrance expert. Interpret a natural language fragrance vibe and extract structured accord parameters. Respond ONLY with valid JSON, no markdown.",
      messages: [{
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
      }],
    });

    const content = msg.content[0];
    if (content.type !== "text") throw new Error("unexpected response");
    const raw = content.text.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "");
    profile = JSON.parse(raw);
  } catch (err) {
    req.log.error({ err }, "Semantic search AI failed");
    res.status(500).json({ error: "Failed to interpret query" });
    return;
  }

  const targetAccords: string[] = profile.target_accords ?? [];
  const avoidAccords: string[] = profile.avoid_accords ?? [];

  const scored = fragrances.map((f) => {
    const matched = f.accords.filter((a) => targetAccords.includes(a));
    const avoided = f.accords.filter((a) => avoidAccords.includes(a));

    let score = 0;
    if (targetAccords.length > 0) score += (matched.length / targetAccords.length) * 78;
    score -= avoided.length * 20;
    if (f.longevity >= (profile.longevity_min ?? 1)) score += 8;
    if (profile.intensity === "strong" && f.sillage >= 3) score += 10;
    if (profile.intensity === "light" && f.sillage <= 2) score += 10;
    if (profile.intensity === "moderate" && f.sillage >= 2 && f.sillage <= 3) score += 8;

    score = Math.max(0, Math.min(100, Math.round(score)));

    const reason = matched.length > 0
      ? `Shares ${matched.slice(0, 3).join(", ")} accord${matched.length > 1 ? "s" : ""} with your vibe`
      : "Partial mood match";

    return { ...f, match_score: score, match_reason: reason };
  });

  const results = scored
    .filter((f) => f.match_score > 15)
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, 9);

  res.json({ interpretation: profile.interpretation, accords: targetAccords, results });
});

export default router;
