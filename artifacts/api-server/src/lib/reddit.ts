/**
 * Reddit r/fragrance data fetcher.
 * Uses the public JSON API — no credentials required.
 */

import { logger } from "./logger.js";

const USER_AGENT = "scentinel-fragrance-app/1.0";
const BASE = "https://www.reddit.com/r/fragrance";

export interface RedditPost {
  title: string;
  url: string;
  score: number;
  num_comments: number;
  selftext: string;
  permalink: string;
}

async function redditFetch(path: string): Promise<RedditPost[]> {
  const url = `${BASE}${path}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      if (res.status === 403 || res.status === 429) {
        // Reddit blocks cloud provider IPs — fail silently
        logger.debug({ status: res.status, url }, "Reddit unavailable from cloud env");
      }
      return [];
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) return [];
    const data = (await res.json()) as {
      data?: { children?: Array<{ data: RedditPost }> };
    };
    return (data.data?.children ?? []).map((c) => c.data);
  } catch (err) {
    logger.debug({ err, url }, "Reddit fetch failed — skipping");
    return [];
  }
}

/**
 * Search r/fragrance for posts about a fragrance.
 * Returns top-voted posts sorted by relevance.
 */
export async function searchFragranceDiscussion(query: string, limit = 5): Promise<RedditPost[]> {
  const q = encodeURIComponent(query);
  const posts = await redditFetch(
    `/search.json?q=${q}&restrict_sr=1&sort=top&limit=${limit}&t=year`
  );
  return posts;
}

/**
 * Search r/fragrance for dupe threads about a specific fragrance.
 */
export async function searchDupeDiscussion(fragranceName: string, limit = 5): Promise<RedditPost[]> {
  const q = encodeURIComponent(`dupe "${fragranceName}"`);
  const posts = await redditFetch(
    `/search.json?q=${q}&restrict_sr=1&sort=top&limit=${limit}&t=all`
  );
  return posts;
}

/**
 * Get hot posts from r/fragrance (for contextual suggestions).
 */
export async function getHotPosts(limit = 10): Promise<RedditPost[]> {
  return redditFetch(`/hot.json?limit=${limit}`);
}

/**
 * Summarise posts into a compact string for use in AI prompts.
 */
export function summarisePosts(posts: RedditPost[], maxLen = 1200): string {
  if (posts.length === 0) return "";
  const lines = posts.map((p) => {
    const body = p.selftext?.slice(0, 200).replace(/\n+/g, " ").trim();
    return `• ${p.title} (↑${p.score}, ${p.num_comments} comments)${body ? `: "${body}"` : ""}`;
  });
  return lines.join("\n").slice(0, maxLen);
}
