import crypto from "crypto";
import { eq, lt } from "drizzle-orm";
import { db, aiResponseCacheTable } from "@workspace/db";

export function makeHash(endpoint: string, payload: unknown): string {
  const sorted = JSON.stringify(payload, Object.keys(payload as Record<string, unknown>).sort());
  return crypto.createHash("sha256").update(`${endpoint}:${sorted}`).digest("hex");
}

export async function getCached(hash: string): Promise<unknown | null> {
  try {
    const [row] = await db
      .select()
      .from(aiResponseCacheTable)
      .where(eq(aiResponseCacheTable.hash, hash))
      .limit(1);
    if (!row) return null;
    if (new Date() > row.expiresAt) {
      db.delete(aiResponseCacheTable)
        .where(eq(aiResponseCacheTable.hash, hash))
        .catch(() => {});
      return null;
    }
    return row.result;
  } catch {
    return null;
  }
}

export async function setCached(
  hash: string,
  endpoint: string,
  inputPayload: unknown,
  result: unknown,
  ttlHours = 24,
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  try {
    await db
      .insert(aiResponseCacheTable)
      .values({
        hash,
        endpoint,
        inputPayload: inputPayload as Record<string, unknown>,
        result: result as Record<string, unknown>,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: aiResponseCacheTable.hash,
        set: {
          result: result as Record<string, unknown>,
          cachedAt: new Date(),
          expiresAt,
        },
      });
  } catch {
    // Cache write failure is non-fatal
  }
}

export async function evictExpired(): Promise<void> {
  try {
    await db
      .delete(aiResponseCacheTable)
      .where(lt(aiResponseCacheTable.expiresAt, new Date()));
  } catch {
    // Non-fatal
  }
}
