import { pgTable, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";

export const aiResponseCacheTable = pgTable(
  "ai_response_cache",
  {
    hash: text("hash").primaryKey(),
    endpoint: text("endpoint").notNull(),
    inputPayload: jsonb("input_payload").notNull(),
    result: jsonb("result").notNull(),
    cachedAt: timestamp("cached_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => [
    index("ai_cache_endpoint_idx").on(table.endpoint),
    index("ai_cache_expires_idx").on(table.expiresAt),
  ],
);

export type AiResponseCacheRow = typeof aiResponseCacheTable.$inferSelect;
