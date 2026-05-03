/**
 * Scentinel MCP Server — Streamable HTTP Transport
 *
 * Exposes Scentinel fragrance tools to Claude (and any MCP-compatible client):
 *   • search_fragrance        — look up any fragrance by name
 *   • find_dupes              — cosine-similarity accord alternatives
 *   • score_blind_buy         — AI blind buy risk scoring
 *   • recommend_for_context   — occasion/weather/time picks from a collection
 *   • community_discussion    — raw r/fragrance posts and summaries
 *   • describe_to_fragrance   — natural language description → matching fragrances
 *   • get_community_signal    — aggregated evidence signals from r/fragrance
 *   • analyse_collection      — DNA profile, gaps, overlaps, and next-buy recs
 *
 * Connect from Claude.ai:
 *   Settings → Integrations → MCP Servers → Add server
 *   URL: https://<your-domain>/api/mcp
 */

import { Router } from "express";
import { randomUUID } from "node:crypto";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Fuse from "fuse.js";
import { sql, ilike, or } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db, aiFragrancesTable } from "@workspace/db";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  isInitializeRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { logger } from "../lib/logger.js";
import { searchFragranceDiscussion, searchDupeDiscussion, summarisePosts } from "../lib/reddit.js";

// ─── Fragrance data ───────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface FragranceNotes { top: string[]; heart: string[]; base: string[]; }
interface Fragrance {
  id: string; name: string; house: string; year: number;
  concentration: string; accords: string[]; notes: FragranceNotes;
  longevity: number; sillage: number; price_usd: number; image_url?: string;
}

const fragrances: Fragrance[] = JSON.parse(
  readFileSync(join(__dirname, "../data/fragrance-data.json"), "utf-8")
);

const fuse = new Fuse(fragrances, { keys: ["name", "house"], threshold: 0.4 });

const ALL_ACCORDS = [
  "fruity","woody","smoky","fresh","citrus","spicy","lavender","vanilla",
  "aromatic","aquatic","mineral","earthy","oud","resinous","sweet","fougere",
  "oriental","floral","amber",
];

function cosineSim(a: number[], b: number[]) {
  const dot = a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);
  const mA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const mB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  return mA && mB ? dot / (mA * mB) : 0;
}
const accordVec = (f: Fragrance) => ALL_ACCORDS.map((a) => (f.accords.includes(a) ? 1 : 0));

async function findFragranceByName(name: string): Promise<Fragrance | null> {
  const local = fragrances.find(
    (f) =>
      f.name.toLowerCase() === name.toLowerCase() ||
      `${f.house} ${f.name}`.toLowerCase() === name.toLowerCase()
  );
  if (local) return local;
  try {
    const rows = await db.select().from(aiFragrancesTable).where(
      or(
        ilike(sql`${aiFragrancesTable.data}->>'name'`, name),
        ilike(sql`${aiFragrancesTable.data}->>'house' || ' ' || ${aiFragrancesTable.data}->>'name'`, name)
      )
    ).limit(1);
    if (rows[0]) return rows[0].data as Fragrance;
  } catch { /* ignore */ }
  return null;
}

// ─── Tool implementations ─────────────────────────────────────────────────────

async function toolSearchFragrance(query: string) {
  const local = fuse.search(query).slice(0, 5).map((r) => r.item);
  if (local.length > 0) return local;
  try {
    const rows = await db.select().from(aiFragrancesTable).where(
      or(
        ilike(sql`${aiFragrancesTable.data}->>'name'`, `%${query}%`),
        ilike(sql`${aiFragrancesTable.data}->>'house'`, `%${query}%`),
        ilike(aiFragrancesTable.searchQuery, `%${query}%`)
      )
    ).limit(5);
    if (rows.length > 0) return rows.map((r) => r.data);
  } catch { /* ignore */ }
  return [];
}

async function toolFindDupes(fragranceName: string, priceCeiling?: number) {
  const target = await findFragranceByName(fragranceName);
  if (!target) return { error: `Fragrance not found: ${fragranceName}` };
  const tv = accordVec(target);
  const [algorithmic, redditPosts] = await Promise.all([
    Promise.resolve(
      fragrances
        .filter((f) => f.id !== target.id && (priceCeiling == null || f.price_usd <= priceCeiling))
        .map((f) => ({
          name: f.name, house: f.house,
          similarity_pct: Math.round(cosineSim(tv, accordVec(f)) * 100),
          price_usd: f.price_usd,
          savings_usd: target.price_usd - f.price_usd,
          accords: f.accords,
        }))
        .sort((a, b) => b.similarity_pct - a.similarity_pct)
        .slice(0, 5)
    ),
    searchDupeDiscussion(`${target.house} ${target.name}`),
  ]);
  return {
    algorithmic_matches: algorithmic,
    community_threads: redditPosts.slice(0, 4).map((p) => ({
      title: p.title,
      score: p.score,
      comments: p.num_comments,
      url: `https://reddit.com${p.permalink}`,
      snippet: p.selftext?.slice(0, 250).replace(/\n+/g, " ").trim() || null,
    })),
  };
}

async function toolScoreBlindBuy(
  fragranceName: string,
  ownedFragrances: string[],
  budget?: number,
) {
  const target = await findFragranceByName(fragranceName);
  if (!target) return { error: `Fragrance not found: ${fragranceName}` };

  const ownedDetails = fragrances
    .filter((f) => ownedFragrances.some((o) =>
      f.name.toLowerCase() === o.toLowerCase() ||
      `${f.house} ${f.name}`.toLowerCase() === o.toLowerCase()
    ))
    .map((f) => `${f.house} ${f.name} (accords: ${f.accords.join(", ")})`);

  const redditPosts = await searchFragranceDiscussion(`${target.house} ${target.name} review`);
  const communityContext = summarisePosts(redditPosts, 1000);

  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: "You are a fragrance expert. Evaluate fragrances for blind buying. Respond ONLY with valid JSON, no markdown.",
    messages: [{
      role: "user",
      content: `Evaluate "${target.house} ${target.name}" (${target.concentration}, $${target.price_usd}) for a blind buy.
Accords: ${target.accords.join(", ")}
Notes — Top: ${target.notes.top.join(", ")}; Heart: ${target.notes.heart.join(", ")}; Base: ${target.notes.base.join(", ")}
Longevity: ${target.longevity}/5, Sillage: ${target.sillage}/5
${budget ? `Budget: $${budget}` : ""}
${ownedDetails.length ? `User collection:\n${ownedDetails.join("\n")}` : "No collection provided."}
${communityContext ? `\nr/fragrance community sentiment:\n${communityContext}` : ""}

Return JSON: { "overall_score": 0-100, "verdict": "Strong buy"|"Buy"|"Try first"|"Avoid", "risk_flags": [{"level":"ok"|"info"|"warn","message":"..."}], "recommendation": "2-3 sentences", "community_sentiment": "brief summary of what r/fragrance says, or null" }`,
    }],
  });
  const content = msg.content[0];
  if (content.type !== "text") return { error: "AI error" };
  const json = content.text.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "");
  return JSON.parse(json);
}

async function toolCommunityDiscussion(query: string) {
  const posts = await searchFragranceDiscussion(query, 8);
  if (posts.length === 0) return { posts: [], summary: "No r/fragrance discussions found for this query." };
  return {
    posts: posts.map((p) => ({
      title: p.title,
      score: p.score,
      comments: p.num_comments,
      url: `https://reddit.com${p.permalink}`,
      snippet: p.selftext?.slice(0, 400).replace(/\n+/g, " ").trim() || null,
    })),
    summary: summarisePosts(posts, 800),
  };
}

async function toolDescribeToFragrance(description: string) {
  // Use Claude to extract accord intent from natural language, then match to database
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 256,
    system: "You are a fragrance expert. Extract fragrance accord families from a natural language description. Respond ONLY with a JSON array of accord strings from this list: fruity, woody, smoky, fresh, citrus, spicy, lavender, vanilla, aromatic, aquatic, mineral, earthy, oud, resinous, sweet, fougere, oriental, floral, amber. Pick 2-5 most relevant.",
    messages: [{ role: "user", content: description }],
  });
  const content = msg.content[0];
  if (content.type !== "text") return { error: "AI error" };

  let targetAccords: string[] = [];
  try {
    const raw = content.text.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "");
    targetAccords = JSON.parse(raw) as string[];
  } catch { return { error: "Could not parse accord intent" }; }

  const targetVec = ALL_ACCORDS.map((a) => (targetAccords.includes(a) ? 1 : 0));
  const matches = fragrances
    .map((f) => ({
      name: f.name,
      house: f.house,
      similarity_pct: Math.round(cosineSim(targetVec, accordVec(f)) * 100),
      price_usd: f.price_usd,
      concentration: f.concentration,
      accords: f.accords,
      why: f.accords.filter((a) => targetAccords.includes(a)).join(", "),
    }))
    .filter((f) => f.similarity_pct > 0)
    .sort((a, b) => b.similarity_pct - a.similarity_pct)
    .slice(0, 6);

  return { description, extracted_accords: targetAccords, matches };
}

async function toolGetCommunitySignal(fragranceName: string) {
  const [reviewPosts, batchPosts] = await Promise.all([
    searchFragranceDiscussion(`${fragranceName} review longevity performance`, 10),
    searchFragranceDiscussion(`${fragranceName} batch variation reformulation`, 6),
  ]);

  const allPosts = [...reviewPosts, ...batchPosts];
  const totalUpvotes = allPosts.reduce((s, p) => s + (p.score ?? 0), 0);
  const totalComments = allPosts.reduce((s, p) => s + (p.num_comments ?? 0), 0);

  const batchKeywords = ["batch", "reformulat", "changed", "degraded", "quality drop"];
  const longevityKeywords = ["lasts", "longevity", "hours", "fades", "projection", "sillage"];
  const positiveKeywords = ["love", "amazing", "great", "excellent", "best", "compliments"];
  const negativeKeywords = ["weak", "awful", "disappointed", "overrated", "skip", "avoid"];

  const allText = allPosts.map((p) => `${p.title} ${p.selftext ?? ""}`.toLowerCase()).join(" ");

  const batchMentions = batchPosts.length;
  const longevityMentions = longevityKeywords.filter((k) => allText.includes(k)).length;
  const positiveScore = positiveKeywords.filter((k) => allText.includes(k)).length;
  const negativeScore = negativeKeywords.filter((k) => allText.includes(k)).length;

  const sentiment = positiveScore > negativeScore * 1.5 ? "positive"
    : negativeScore > positiveScore * 1.5 ? "negative" : "mixed";

  return {
    fragrance: fragranceName,
    evidence: {
      total_posts_found: allPosts.length,
      total_upvotes: totalUpvotes,
      total_comments: totalComments,
    },
    signals: {
      batch_variation_risk: batchMentions >= 2 ? "flagged" : "clean",
      batch_mentions: batchMentions,
      longevity_discussion_intensity: longevityMentions >= 3 ? "high" : longevityMentions >= 1 ? "moderate" : "low",
      community_sentiment: sentiment,
      positive_signals: positiveScore,
      negative_signals: negativeScore,
    },
    batch_keywords_found: batchKeywords.filter((k) => allText.includes(k)),
    summary: summarisePosts(reviewPosts, 600),
  };
}

function toolAnalyseCollection(ownedFragrances: string[]) {
  const owned = fragrances.filter((f) =>
    ownedFragrances.some((o) =>
      f.name.toLowerCase() === o.toLowerCase() ||
      `${f.house} ${f.name}`.toLowerCase() === o.toLowerCase()
    )
  );
  if (owned.length === 0) return { error: "No known fragrances found in collection" };

  // DNA: tally accords across collection
  const accordCounts: Record<string, number> = {};
  owned.forEach((f) => f.accords.forEach((a) => { accordCounts[a] = (accordCounts[a] ?? 0) + 1; }));
  const dna = Object.entries(accordCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([accord, count]) => ({ accord, count, pct: Math.round((count / owned.length) * 100) }));

  // Overlaps: pairs that are >75% similar
  const overlaps: { a: string; b: string; similarity_pct: number }[] = [];
  for (let i = 0; i < owned.length; i++) {
    for (let j = i + 1; j < owned.length; j++) {
      const sim = Math.round(cosineSim(accordVec(owned[i]!), accordVec(owned[j]!)) * 100);
      if (sim >= 75) overlaps.push({ a: `${owned[i]!.house} ${owned[i]!.name}`, b: `${owned[j]!.house} ${owned[j]!.name}`, similarity_pct: sim });
    }
  }

  // Gaps: accord families not represented at all
  const coveredAccords = new Set(owned.flatMap((f) => f.accords));
  const gaps = ALL_ACCORDS.filter((a) => !coveredAccords.has(a));

  // Collection profile stats
  const avgPrice = Math.round(owned.reduce((s, f) => s + f.price_usd, 0) / owned.length);
  const avgLongevity = (owned.reduce((s, f) => s + f.longevity, 0) / owned.length).toFixed(1);
  const avgSillage = (owned.reduce((s, f) => s + f.sillage, 0) / owned.length).toFixed(1);

  // Next-buy recommendations: fragrances NOT owned that fill the biggest gaps
  const dominantAccords = dna.slice(0, 3).map((d) => d.accord);
  const gapAccords = gaps.slice(0, 3);
  const candidates = fragrances
    .filter((f) => !owned.find((o) => o.id === f.id))
    .map((f) => {
      const gapFill = f.accords.filter((a) => gapAccords.includes(a)).length;
      const complement = f.accords.filter((a) => !dominantAccords.includes(a)).length;
      return { f, score: gapFill * 3 + complement };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ f }) => ({
      name: f.name,
      house: f.house,
      price_usd: f.price_usd,
      accords: f.accords,
      fills_gap: f.accords.filter((a) => gapAccords.includes(a)),
    }));

  return {
    collection_size: owned.length,
    dna_profile: dna.slice(0, 8),
    stats: { avg_price_usd: avgPrice, avg_longevity: avgLongevity, avg_sillage: avgSillage },
    gaps: { missing_accord_families: gaps, count: gaps.length },
    overlaps: { pairs: overlaps, count: overlaps.length },
    next_buy_recommendations: candidates,
  };
}

function toolRecommendForContext(
  occasion: string,
  timeOfDay: string,
  ownedFragrances: string[],
  weatherTemp = 15,
) {
  const candidates = fragrances.filter((f) =>
    ownedFragrances.some((o) =>
      f.name.toLowerCase() === o.toLowerCase() ||
      `${f.house} ${f.name}`.toLowerCase() === o.toLowerCase()
    )
  );
  if (candidates.length === 0) return { error: "No fragrances found in provided collection" };

  const occ = occasion.toLowerCase();
  const tod = timeOfDay.toLowerCase();

  const scored = candidates.map((f) => {
    let score = 50;
    if (occ.includes("office")) {
      if (f.longevity >= 2 && f.longevity <= 3) score += 15;
      if (f.sillage <= 2) score += 15;
    } else if (occ.includes("date") || occ.includes("evening") || occ.includes("dinner")) {
      if (f.sillage >= 3) score += 15;
      if (f.accords.some((a) => ["oriental","oud","woody","spicy"].includes(a))) score += 10;
    } else if (occ.includes("casual") || occ.includes("outdoor")) {
      if (f.accords.some((a) => ["fresh","citrus","aquatic","floral"].includes(a))) score += 15;
    }
    if (weatherTemp > 22) {
      if (f.accords.some((a) => ["fresh","citrus","aquatic"].includes(a))) score += 20;
    } else if (weatherTemp < 12) {
      if (f.accords.some((a) => ["woody","spicy","oud","oriental"].includes(a))) score += 20;
    } else { score += 10; }
    if (tod.includes("morning")) {
      if (f.accords.some((a) => ["fresh","citrus","aromatic"].includes(a))) score += 15;
    } else if (tod.includes("evening") || tod.includes("night")) {
      if (f.accords.some((a) => ["oriental","woody","oud","smoky"].includes(a))) score += 15;
    }
    const reasons: string[] = [];
    if (weatherTemp > 22 && f.accords.some((a) => ["fresh","citrus"].includes(a))) reasons.push("great for warm weather");
    if (weatherTemp < 12 && f.accords.some((a) => ["woody","spicy"].includes(a))) reasons.push("ideal for cold conditions");
    if (occ.includes("office") && f.sillage <= 2) reasons.push("subtle enough for the office");
    if ((tod.includes("evening") || tod.includes("night")) && f.accords.some((a) => ["woody","oud"].includes(a))) reasons.push("excellent for evening");
    return { fragrance: f, score, reason: reasons.length ? reasons.join(", ") : "versatile for this context" };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item, i) => ({
      rank: i + 1,
      name: item.fragrance.name,
      house: item.fragrance.house,
      match_pct: Math.min(100, item.score),
      reason: item.reason.charAt(0).toUpperCase() + item.reason.slice(1),
      accords: item.fragrance.accords,
      price_usd: item.fragrance.price_usd,
    }));
}

// ─── MCP server factory ───────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "search_fragrance",
    description: "Search for a fragrance by name or query. Returns notes, accords, longevity, sillage, and price for matching fragrances from a database of 230+ entries.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Fragrance name or search query (e.g. 'Creed Aventus', 'Sauvage', 'oud wood')" },
      },
      required: ["query"],
    },
  },
  {
    name: "find_dupes",
    description: "Find similar fragrance alternatives (dupes) using cosine similarity on accord vectors. Optionally filter by price ceiling to find cheaper alternatives.",
    inputSchema: {
      type: "object" as const,
      properties: {
        fragrance_name: { type: "string", description: "Name of the fragrance to find dupes for (e.g. 'Creed Aventus' or 'Aventus')" },
        price_ceiling: { type: "number", description: "Maximum price in USD — omit for no limit" },
      },
      required: ["fragrance_name"],
    },
  },
  {
    name: "score_blind_buy",
    description: "AI-powered blind buy risk assessment. Scores 0-100 and gives a verdict (Strong buy / Buy / Try first / Avoid) with specific risk flags. Optionally personalised to the user's collection.",
    inputSchema: {
      type: "object" as const,
      properties: {
        fragrance_name: { type: "string", description: "Full fragrance name including house (e.g. 'Amouage Jubilation XXV Man')" },
        owned_fragrances: {
          type: "array",
          items: { type: "string" },
          description: "Names of fragrances the user already owns — used to check overlap and compatibility (optional)",
        },
        budget: { type: "number", description: "User's max budget in USD (optional)" },
      },
      required: ["fragrance_name"],
    },
  },
  {
    name: "recommend_for_context",
    description: "Recommend fragrances from a user's collection for a specific occasion and time of day, optionally accounting for weather.",
    inputSchema: {
      type: "object" as const,
      properties: {
        occasion: { type: "string", description: "e.g. office, date, casual, evening, outdoor, wedding, gym" },
        time_of_day: { type: "string", description: "e.g. morning, daytime, evening, night" },
        owned_fragrances: {
          type: "array",
          items: { type: "string" },
          description: "Names of fragrances in the user's collection",
        },
        weather_temp_c: { type: "number", description: "Current temperature in Celsius (optional, defaults to 15°C)" },
      },
      required: ["occasion", "time_of_day", "owned_fragrances"],
    },
  },
  {
    name: "community_discussion",
    description: "Fetch real r/fragrance community posts and discussions about a fragrance — reviews, opinions, batch variation issues, real-world performance, and comparisons.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Fragrance name or topic to search r/fragrance for (e.g. 'Creed Aventus batch variation', 'Bleu de Chanel longevity')" },
      },
      required: ["query"],
    },
  },
  {
    name: "describe_to_fragrance",
    description: "Find fragrances matching a natural language vibe description. Use when the user doesn't know what fragrance they want but describes a feeling, setting, or aesthetic — e.g. 'smells like a rainy forest', 'cosy fireplace on a winter night', 'clean office professional'. Claude extracts the accord intent; the tool searches the database.",
    inputSchema: {
      type: "object" as const,
      properties: {
        description: { type: "string", description: "Natural language description of the desired scent vibe, setting, or aesthetic (e.g. 'I want to smell like a library with a fireplace', 'beachy and fresh for summer')" },
      },
      required: ["description"],
    },
  },
  {
    name: "get_community_signal",
    description: "Get aggregated community evidence signals for a fragrance — upvote totals, batch variation risk flag, longevity discussion intensity, and sentiment score backed by actual Reddit evidence counts. Use this when you need to cite trust signals or risk flags with evidence.",
    inputSchema: {
      type: "object" as const,
      properties: {
        fragrance_name: { type: "string", description: "Full fragrance name including house (e.g. 'Creed Aventus', 'Dior Sauvage EDP')" },
      },
      required: ["fragrance_name"],
    },
  },
  {
    name: "analyse_collection",
    description: "Analyse a user's fragrance collection — returns DNA profile (dominant accords), gaps (missing fragrance families), overlapping redundant pairs, collection stats (avg price, longevity, sillage), and top 3 'what to buy next' recommendations that fill gaps. Use after the user shares their collection to give personalised fragrance advice.",
    inputSchema: {
      type: "object" as const,
      properties: {
        owned_fragrances: {
          type: "array",
          items: { type: "string" },
          description: "Names of all fragrances in the user's collection (e.g. ['Creed Aventus', 'Dior Sauvage EDT', 'YSL La Nuit de L\\'Homme'])",
        },
      },
      required: ["owned_fragrances"],
    },
  },
];

function createMcpServer(): Server {
  const server = new Server(
    { name: "scentinel", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args = {} } = req.params;
    const a = args as Record<string, unknown>;

    try {
      let result: unknown;

      if (name === "search_fragrance") {
        result = await toolSearchFragrance(a.query as string);
      } else if (name === "find_dupes") {
        result = await toolFindDupes(a.fragrance_name as string, a.price_ceiling as number | undefined);
      } else if (name === "score_blind_buy") {
        result = await toolScoreBlindBuy(
          a.fragrance_name as string,
          (a.owned_fragrances as string[] | undefined) ?? [],
          a.budget as number | undefined
        );
      } else if (name === "recommend_for_context") {
        result = toolRecommendForContext(
          a.occasion as string,
          a.time_of_day as string,
          a.owned_fragrances as string[],
          a.weather_temp_c as number | undefined
        );
      } else if (name === "community_discussion") {
        result = await toolCommunityDiscussion(a.query as string);
      } else if (name === "describe_to_fragrance") {
        result = await toolDescribeToFragrance(a.description as string);
      } else if (name === "get_community_signal") {
        result = await toolGetCommunitySignal(a.fragrance_name as string);
      } else if (name === "analyse_collection") {
        result = toolAnalyseCollection(a.owned_fragrances as string[]);
      } else {
        return { content: [{ type: "text" as const, text: `Unknown tool: ${name}` }], isError: true };
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        }],
      };
    } catch (err) {
      logger.error({ err, tool: name }, "MCP tool execution error");
      return {
        content: [{ type: "text" as const, text: `Error: ${String(err)}` }],
        isError: true,
      };
    }
  });

  return server;
}

// ─── Session store ────────────────────────────────────────────────────────────

const sessions = new Map<string, StreamableHTTPServerTransport>();

// Clean up old sessions every 30 minutes (they're memory-only)
setInterval(() => {
  logger.info({ count: sessions.size }, "MCP active sessions");
}, 30 * 60 * 1000);

// ─── Express router ───────────────────────────────────────────────────────────

const router = Router();

// All MCP requests go through POST /mcp (Streamable HTTP transport)
router.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  // Existing session → reuse transport
  if (sessionId) {
    const transport = sessions.get(sessionId);
    if (!transport) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    await transport.handleRequest(req, res, req.body);
    return;
  }

  // New session — must be an initialize request
  if (!isInitializeRequest(req.body)) {
    res.status(400).json({ error: "Expected initialize request" });
    return;
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sid) => {
      sessions.set(sid, transport);
      logger.info({ sessionId: sid }, "MCP session created");
    },
  });

  transport.onclose = () => {
    const sid = transport.sessionId;
    if (sid) {
      sessions.delete(sid);
      logger.info({ sessionId: sid }, "MCP session closed");
    }
  };

  const server = createMcpServer();
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// GET /mcp — SSE stream for server-to-client messages
router.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId) {
    res.status(400).json({ error: "mcp-session-id header required" });
    return;
  }
  const transport = sessions.get(sessionId);
  if (!transport) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  await transport.handleRequest(req, res);
});

// DELETE /mcp — terminate session
router.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId) {
    const transport = sessions.get(sessionId);
    if (transport) {
      await transport.close();
      sessions.delete(sessionId);
    }
  }
  res.status(200).json({ ok: true });
});

export default router;
