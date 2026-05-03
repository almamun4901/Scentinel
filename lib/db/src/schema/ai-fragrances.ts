import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export interface CachedFragrance {
  id: string;
  name: string;
  house: string;
  year: number;
  concentration: string;
  accords: string[];
  notes: { top: string[]; heart: string[]; base: string[] };
  longevity: number;
  sillage: number;
  price_usd: number;
  image_url?: string;
}

export const aiFragrancesTable = pgTable("ai_fragrances", {
  id: text("id").primaryKey(),
  searchQuery: text("search_query").notNull(),
  data: jsonb("data").$type<CachedFragrance>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
