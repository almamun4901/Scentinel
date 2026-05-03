import { pgTable, text, jsonb, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";

export const wishlistsTable = pgTable(
  "wishlists",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    fragranceId: text("fragrance_id").notNull(),
    fragranceName: text("fragrance_name").notNull(),
    fragranceData: jsonb("fragrance_data").$type<Record<string, unknown>>().notNull(),
    personalNote: text("personal_note").notNull().default(""),
    addedAt: timestamp("added_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("wishlists_user_fragrance_idx").on(table.userId, table.fragranceId),
    index("wishlists_user_idx").on(table.userId),
  ],
);

export type WishlistRow = typeof wishlistsTable.$inferSelect;
