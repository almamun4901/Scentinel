/**
 * Reddit r/fragrance data fetcher.
 * Uses Reddit OAuth2 app-only auth (client credentials) when credentials are
 * available — this bypasses the cloud-IP block that the public JSON API enforces.
 * Falls back to the public JSON API when no credentials are set.
 */

import { logger } from "./logger.js";

const USER_AGENT = "scentinel-fragrance-app/1.0 (by /u/scentinel_bot)";

export interface RedditPost {
  title: string;
  url: string;
  score: number;
  num_comments: number;
  selftext: string;
  permalink: string;
}

// ─── OAuth token cache ────────────────────────────────────────────────────────

interface TokenCache {
  token: string;
  expiresAt: number;
}

let cachedToken: TokenCache | null = null;

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const res = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      logger.warn({ status: res.status }, "Reddit OAuth token request failed");
      return null;
    }

    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;

    cachedToken = {
      token: data.access_token,
      // Refresh 60 s before actual expiry (default Reddit token TTL is 3600 s)
      expiresAt: Date.now() + ((data.expires_in ?? 3600) - 60) * 1000,
    };

    logger.debug("Reddit OAuth token refreshed");
    return cachedToken.token;
  } catch (err) {
    logger.warn({ err }, "Reddit OAuth token fetch failed");
    return null;
  }
}

// ─── Core fetch ───────────────────────────────────────────────────────────────

async function redditFetch(path: string): Promise<RedditPost[]> {
  const token = await getAccessToken();

  const useOAuth = token !== null;
  const baseUrl = useOAuth
    ? "https://oauth.reddit.com/r/fragrance"
    : "https://www.reddit.com/r/fragrance";

  const url = `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    Accept: "application/json",
  };
  if (useOAuth && token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      logger.warn({ status: res.status, url, useOAuth }, "Reddit fetch returned non-OK status");
      return [];
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      logger.warn({ contentType, url }, "Reddit returned non-JSON response");
      return [];
    }

    const data = (await res.json()) as {
      data?: { children?: Array<{ data: RedditPost }> };
    };
    const posts = (data.data?.children ?? []).map((c) => c.data);
    logger.debug({ count: posts.length, useOAuth, query: path.slice(0, 80) }, "Reddit posts fetched");
    return posts;
  } catch (err) {
    logger.warn({ err, url }, "Reddit fetch failed");
    return [];
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Search r/fragrance for posts about a fragrance.
 * Returns top-voted posts sorted by relevance.
 */
export async function searchFragranceDiscussion(query: string, limit = 5): Promise<RedditPost[]> {
  const q = encodeURIComponent(query);
  return redditFetch(`/search.json?q=${q}&restrict_sr=1&sort=top&limit=${limit}&t=year`);
}

/**
 * Search r/fragrance for dupe threads about a specific fragrance.
 */
export async function searchDupeDiscussion(fragranceName: string, limit = 5): Promise<RedditPost[]> {
  const q = encodeURIComponent(`dupe "${fragranceName}"`);
  return redditFetch(`/search.json?q=${q}&restrict_sr=1&sort=top&limit=${limit}&t=all`);
}

/**
 * Get hot posts from r/fragrance.
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
