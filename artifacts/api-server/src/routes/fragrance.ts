import { Router } from "express";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Fuse from "fuse.js";
import { anthropic } from "@workspace/integrations-anthropic-ai";
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
  price_gbp: number;
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

const router = Router();

// GET /search?q=
router.get("/search", (req, res) => {
  const parsed = SearchFragrancesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid query parameter q" });
    return;
  }
  const { q } = parsed.data;
  const results = fuse.search(q).slice(0, 10).map((r) => r.item);
  res.json(results);
});

// POST /dupes
router.post("/dupes", (req, res) => {
  const parsed = FindDupesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { fragranceName, priceCeiling } = parsed.data;

  const target = fragrances.find(
    (f) => f.name.toLowerCase() === fragranceName.toLowerCase() ||
      `${f.house} ${f.name}`.toLowerCase() === fragranceName.toLowerCase()
  );
  if (!target) {
    res.status(404).json({ error: `Fragrance not found: ${fragranceName}` });
    return;
  }

  const targetVec = buildAccordVector(target, allAccords);

  const results = fragrances
    .filter((f) => f.id !== target.id)
    .filter((f) => priceCeiling == null || f.price_gbp <= priceCeiling)
    .map((f) => {
      const vec = buildAccordVector(f, allAccords);
      const sim = cosineSimilarity(targetVec, vec);
      return {
        name: f.name,
        house: f.house,
        similarity_pct: Math.round(sim * 100),
        price_gbp: f.price_gbp,
        price_delta: target.price_gbp - f.price_gbp,
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

    // Occasion scoring
    if (occasion?.toLowerCase().includes("office")) {
      if (f.longevity >= 2 && f.longevity <= 3) score += 15;
      if (f.sillage <= 2) score += 15;
    } else if (occasion?.toLowerCase().includes("date") || occasion?.toLowerCase().includes("evening")) {
      if (f.sillage >= 3) score += 15;
      if (f.accords.some((a) => ["oriental", "oud", "woody", "spicy"].includes(a))) score += 10;
    } else if (occasion?.toLowerCase().includes("casual") || occasion?.toLowerCase().includes("outdoor")) {
      if (f.accords.some((a) => ["fresh", "citrus", "aquatic"].includes(a))) score += 15;
    }

    // Season/temp scoring
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

    // Time of day scoring
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

  const target = fragrances.find(
    (f) =>
      f.name.toLowerCase() === fragranceName.toLowerCase() ||
      `${f.house} ${f.name}`.toLowerCase() === fragranceName.toLowerCase()
  );
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
Price: £${target.price_gbp}
Accords: ${target.accords.join(", ")}
Top Notes: ${target.notes.top.join(", ")}
Heart Notes: ${target.notes.heart.join(", ")}
Base Notes: ${target.notes.base.join(", ")}
Longevity (1-5): ${target.longevity}
Sillage (1-5): ${target.sillage}
${budget ? `User Budget: £${budget}` : ""}
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

export default router;
