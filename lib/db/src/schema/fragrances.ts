import { pgTable, text, jsonb, integer, timestamp, index } from "drizzle-orm/pg-core";

export interface FragranceNotes {
  top: string[];
  heart: string[];
  base: string[];
}

export interface FragranceRecord {
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

export const fragrancesTable = pgTable(
  "fragrances",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    house: text("house").notNull(),
    year: integer("year").notNull(),
    concentration: text("concentration").notNull(),
    accords: jsonb("accords").$type<string[]>().notNull().default([]),
    notes: jsonb("notes").$type<FragranceNotes>().notNull(),
    longevity: integer("longevity").notNull(),
    sillage: integer("sillage").notNull(),
    priceUsd: integer("price_usd").notNull(),
    imageUrl: text("image_url"),
    source: text("source").notNull().default("seed"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("fragrances_house_idx").on(table.house),
    index("fragrances_name_idx").on(table.name),
  ],
);

export type FragranceRow = typeof fragrancesTable.$inferSelect;
