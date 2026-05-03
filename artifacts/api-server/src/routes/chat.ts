import { Router } from "express";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Fuse from "fuse.js";
import { sql, ilike, or } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { db, aiFragrancesTable } from "@workspace/db";
import type { MessageParam, Tool, ToolResultBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { searchFragranceDiscussion, searchDupeDiscussion, summarisePosts } from "../lib/reddit.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface FragranceNotes { top: string[]; heart: string[]; base: string[]; }
interface Fragrance {
  id: string; name: string; house: string; year: number;
  concentration: string; accords: string[]; notes: FragranceNotes;
  longevity: number; sillage: number; price_usd: number; image_url?: string;
}

const fragrancesPath = join(__dirname, "../data/fragrance-data.json");
const fragrances: Fragrance[] = JSON.parse(readFileSync(fragrancesPath, "utf-8"));

const fuse = new Fuse(fragrances, { keys: ["name", "house"], threshold: 0.4 });

const allAccords = [
  "fruity","woody","smoky","fresh","citrus","spicy","lavender","vanilla",
  "aromatic","aquatic","mineral","earthy","oud","resinous","sweet","fougere",
  "oriental","floral","amber",
];

function cosineSim(a: number[], b: number[]): number {
  const dot = a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);
  const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  return magA && magB ? dot / (magA * magB) : 0;
}
function accordVec(f: Fragrance) { return allAccords.map((a) => (f.accords.includes(a) ? 1 : 0)); }

function findFragrance(name: string): Fragrance | undefined {
  return fragrances.find(
    (f) =>
      f.name.toLowerCase() === name.toLowerCase() ||
      `${f.house} ${f.name}`.toLowerCase() === name.toLowerCase()
  );
}

async function findFragranceWithCache(name: string): Promise<Fragrance | null> {
  const local = findFragrance(name);
  if (local) return local;
  try {
    const cached = await db.select().from(aiFragrancesTable).where(
      or(
        ilike(sql`${aiFragrancesTable.data}->>'name'`, name),
        ilike(sql`${aiFragrancesTable.data}->>'house' || ' ' || ${aiFragrancesTable.data}->>'name'`, name)
      )
    ).limit(1);
    if (cached[0]) return cached[0].data as Fragrance;
  } catch { /* ignore */ }
  return null;
}

const CHAT_TOOLS: Tool[] = [
  {
    name: "find_dupes",
    description: "Find similar fragrance alternatives or dupes, optionally under a price ceiling in USD. Includes community-sourced dupe discussions from r/fragrance.",
    input_schema: {
      type: "object" as const,
      properties: {
        fragrance_name: { type: "string", description: "Name of the fragrance to find dupes for" },
        price_ceiling: { type: "number", description: "Maximum price in USD (optional)" },
      },
      required: ["fragrance_name"],
    },
  },
  {
    name: "score_blind_buy",
    description: "Score a fragrance for blind buying given the user's collection and budget. Returns 0-100 score, verdict, and risk flags. Augmented with r/fragrance community reviews.",
    input_schema: {
      type: "object" as const,
      properties: {
        fragrance_name: { type: "string", description: "Full fragrance name including house" },
      },
      required: ["fragrance_name"],
    },
  },
  {
    name: "recommend_for_context",
    description: "Recommend fragrances from the user's collection for a specific occasion and time of day.",
    input_schema: {
      type: "object" as const,
      properties: {
        occasion: { type: "string", description: "e.g. office, date, casual, evening, outdoor, wedding" },
        time_of_day: { type: "string", description: "e.g. morning, daytime, evening, night" },
      },
      required: ["occasion", "time_of_day"],
    },
  },
  {
    name: "search_fragrance",
    description: "Look up details about a specific fragrance — notes, accords, longevity, sillage, price.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Fragrance name or search query" },
      },
      required: ["query"],
    },
  },
  {
    name: "community_discussion",
    description: "Fetch real r/fragrance community posts and discussions about a fragrance — reviews, opinions, batch issues, performance reports, comparisons.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Fragrance name or topic to search r/fragrance for (e.g. 'Creed Aventus batch variation', 'Bleu de Chanel review')" },
      },
      required: ["query"],
    },
  },
];

async function execFindDupes(fragranceName: string, priceCeiling?: number) {
  const target = await findFragranceWithCache(fragranceName);
  if (!target) return { error: `Fragrance not found: ${fragranceName}` };
  const targetVec = accordVec(target);
  const [algorithmic, redditPosts] = await Promise.all([
    Promise.resolve(
      fragrances
        .filter((f) => f.id !== target.id && (priceCeiling == null || f.price_usd <= priceCeiling))
        .map((f) => ({
          name: f.name, house: f.house,
          similarity_pct: Math.round(cosineSim(targetVec, accordVec(f)) * 100),
          price_usd: f.price_usd,
          price_delta: target.price_usd - f.price_usd,
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

async function execScoreBlindBuy(fragranceName: string, ownedFragrances: string[], budget: number | null) {
  const target = await findFragranceWithCache(fragranceName);
  if (!target) return { error: `Fragrance not found: ${fragranceName}` };

  const ownedDetails = fragrances
    .filter((f) => ownedFragrances.some((o) =>
      f.name.toLowerCase() === o.toLowerCase() ||
      `${f.house} ${f.name}`.toLowerCase() === o.toLowerCase()
    ))
    .map((f) => `${f.house} ${f.name} (accords: ${f.accords.join(", ")})`);

  const redditPosts = await searchFragranceDiscussion(`${target.house} ${target.name} review`);
  const communityContext = summarisePosts(redditPosts, 1000);

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: `You are a fragrance expert. Evaluate fragrances for blind buying. Respond with ONLY valid JSON, no markdown.`,
    messages: [{
      role: "user",
      content: `Evaluate ${target.house} ${target.name} (${target.concentration}, $${target.price_usd}) for a blind buy.
Accords: ${target.accords.join(", ")}
Notes — Top: ${target.notes.top.join(", ")}; Heart: ${target.notes.heart.join(", ")}; Base: ${target.notes.base.join(", ")}
Longevity: ${target.longevity}/5, Sillage: ${target.sillage}/5
${budget ? `Budget: $${budget}` : ""}
${ownedDetails.length ? `Collection:\n${ownedDetails.join("\n")}` : "No collection."}
${communityContext ? `\nr/fragrance community sentiment:\n${communityContext}` : ""}

Return JSON: { "overall_score": 0-100, "breakdown": { "accord_compatibility": 0-100, "community_longevity": 0-100, "batch_consistency": 0-100, "price_value": 0-100 }, "verdict": "Strong buy"|"Buy"|"Try first"|"Avoid", "risk_flags": [{ "level": "ok"|"info"|"warn", "message": "..." }], "recommendation": "2-3 sentences", "community_sentiment": "brief summary of what r/fragrance says, or null" }`,
    }],
  });
  const content = message.content[0];
  if (content.type !== "text") return { error: "AI response error" };
  const json = content.text.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "");
  return JSON.parse(json);
}

async function execCommunityDiscussion(query: string) {
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

function execRecommendForContext(
  occasion: string,
  timeOfDay: string,
  ownedFragrances: string[],
  weatherTemp: number,
) {
  const candidates = fragrances.filter((f) =>
    ownedFragrances.some(
      (o) =>
        f.name.toLowerCase() === o.toLowerCase() ||
        `${f.house} ${f.name}`.toLowerCase() === o.toLowerCase()
    )
  );
  if (candidates.length === 0) return { error: "No fragrances in collection" };

  const scored = candidates.map((f) => {
    let score = 50;
    const occ = occasion.toLowerCase();
    const tod = timeOfDay.toLowerCase();

    if (occ.includes("office")) {
      if (f.longevity >= 2 && f.longevity <= 3) score += 15;
      if (f.sillage <= 2) score += 15;
    } else if (occ.includes("date") || occ.includes("evening") || occ.includes("dinner")) {
      if (f.sillage >= 3) score += 15;
      if (f.accords.some((a) => ["oriental","oud","woody","spicy"].includes(a))) score += 10;
    } else if (occ.includes("casual") || occ.includes("outdoor") || occ.includes("wedding")) {
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
    if (weatherTemp < 12 && f.accords.some((a) => ["woody","spicy"].includes(a))) reasons.push("perfect for cold conditions");
    if (occ.includes("office") && f.sillage <= 2) reasons.push("subtle enough for the office");
    if ((tod.includes("evening") || tod.includes("night")) && f.accords.some((a) => ["woody","oud"].includes(a))) reasons.push("ideal for evening wear");

    return {
      fragrance: f, score,
      reason: reasons.length > 0 ? reasons.join(", ") : "solid all-rounder for this context",
    };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item, i) => ({
      rank: i + 1,
      name: item.fragrance.name,
      house: item.fragrance.house,
      reason: item.reason.charAt(0).toUpperCase() + item.reason.slice(1),
      match_pct: Math.min(100, item.score),
    }));
}

async function execSearchFragrance(query: string) {
  const local = fuse.search(query).slice(0, 3).map((r) => r.item);
  if (local.length > 0) return local[0];
  try {
    const cached = await db.select().from(aiFragrancesTable).where(
      or(
        ilike(sql`${aiFragrancesTable.data}->>'name'`, `%${query}%`),
        ilike(aiFragrancesTable.searchQuery, `%${query}%`)
      )
    ).limit(1);
    if (cached[0]) return cached[0].data;
  } catch { /* ignore */ }
  return { error: `Fragrance not found: ${query}` };
}

function formatToolLabel(name: string, input: Record<string, unknown>, result: unknown): string {
  if (name === "find_dupes") {
    const r = result as Record<string, unknown>;
    const count = Array.isArray(r?.algorithmic_matches) ? r.algorithmic_matches.length : 0;
    const threads = Array.isArray(r?.community_threads) ? r.community_threads.length : 0;
    const price = input.price_ceiling ? `, $${input.price_ceiling}` : "";
    return `find_dupes("${input.fragrance_name}"${price}) — ${count} matches, ${threads} community threads`;
  }
  if (name === "score_blind_buy") {
    const score = (result as Record<string, unknown>)?.overall_score ?? "?";
    return `score_blind_buy("${input.fragrance_name}") — ${score}/100`;
  }
  if (name === "recommend_for_context") {
    const count = Array.isArray(result) ? result.length : 0;
    return `recommend_for_context(occasion="${input.occasion}", time="${input.time_of_day}") — ${count} picks`;
  }
  if (name === "search_fragrance") {
    return `search_fragrance("${input.query}")`;
  }
  if (name === "community_discussion") {
    const r = result as Record<string, unknown>;
    const count = Array.isArray(r?.posts) ? r.posts.length : 0;
    return `community_discussion("${input.query}") — ${count} r/fragrance posts`;
  }
  return name;
}

const router = Router();

router.post("/chat", async (req, res) => {
  const { message, history = [], profile = {}, weatherTemp = 18, weatherDesc = "partly cloudy" } = req.body as {
    message: string;
    history: Array<{ role: "user" | "assistant"; content: string }>;
    profile: { ownedFragrances?: string[]; budget?: string | null };
    weatherTemp: number;
    weatherDesc: string;
  };

  if (!message) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const ownedFragrances: string[] = profile.ownedFragrances ?? [];
  const budgetRaw = profile.budget;
  const budgetMap: Record<string, number> = { under_50: 65, "50_150": 200, "150_300": 400, no_limit: 9999 };
  const budget: number | null = budgetRaw ? (budgetMap[budgetRaw] ?? null) : null;

  const systemPrompt = `You are Scentinel, an expert fragrance intelligence assistant with encyclopedic knowledge of perfumery. You are direct, opinionated, and concise — you give real recommendations, not hedged non-answers.

Current context:
- Weather: ${weatherTemp}°C, ${weatherDesc}
- User's collection (${ownedFragrances.length} fragrances): ${ownedFragrances.length ? ownedFragrances.join(", ") : "none added yet"}
- Budget: ${budget ? `up to $${budget}` : "not specified"}

Use tools whenever relevant. After tool results, give a short, direct synthesis — don't just repeat the data. Highlight the single best choice when asked. Mention prices in USD. Do not mention tool names in your response. Keep responses concise.

You have access to r/fragrance community data. Use the community_discussion tool when the user asks for opinions, reviews, real-world performance, batch variation issues, or community consensus on any fragrance. Blend community sentiment naturally into your answer.`;

  const claudeMessages: MessageParam[] = [
    ...history.map((h) => ({ role: h.role, content: h.content } as MessageParam)),
    { role: "user", content: message },
  ];

  const executedToolCalls: Array<{ label: string; type: string; result: unknown }> = [];
  let iteration = 0;

  while (iteration < 5) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      tools: CHAT_TOOLS,
      messages: claudeMessages,
    });

    const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");

    if (toolUseBlocks.length === 0 || response.stop_reason === "end_turn") {
      const textBlock = response.content.find((b) => b.type === "text");
      const text = textBlock?.type === "text" ? textBlock.text : "";
      res.json({ text, toolCalls: executedToolCalls });
      return;
    }

    const toolResults: ToolResultBlockParam[] = [];

    for (const block of toolUseBlocks) {
      if (block.type !== "tool_use") continue;
      const inp = block.input as Record<string, unknown>;
      let result: unknown;

      try {
        if (block.name === "find_dupes") {
          result = await execFindDupes(inp.fragrance_name as string, inp.price_ceiling as number | undefined);
        } else if (block.name === "score_blind_buy") {
          result = await execScoreBlindBuy(inp.fragrance_name as string, ownedFragrances, budget);
        } else if (block.name === "recommend_for_context") {
          result = execRecommendForContext(inp.occasion as string, inp.time_of_day as string, ownedFragrances, weatherTemp);
        } else if (block.name === "search_fragrance") {
          result = await execSearchFragrance(inp.query as string);
        } else if (block.name === "community_discussion") {
          result = await execCommunityDiscussion(inp.query as string);
        } else {
          result = { error: `Unknown tool: ${block.name}` };
        }
      } catch (err) {
        result = { error: String(err) };
      }

      executedToolCalls.push({ label: formatToolLabel(block.name, inp, result), type: block.name, result });
      toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
    }

    claudeMessages.push({ role: "assistant", content: response.content });
    claudeMessages.push({ role: "user", content: toolResults });
    iteration++;
  }

  res.json({ text: "I've gathered that information for you.", toolCalls: executedToolCalls });
});

export default router;
