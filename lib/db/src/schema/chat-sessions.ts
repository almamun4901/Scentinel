import { pgTable, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: unknown[];
  createdAt: string;
}

export const chatSessionsTable = pgTable(
  "chat_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    title: text("title").notNull().default("New conversation"),
    messages: jsonb("messages").$type<StoredMessage[]>().notNull().default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("chat_sessions_user_idx").on(table.userId),
    index("chat_sessions_updated_idx").on(table.updatedAt),
  ],
);

export type ChatSessionRow = typeof chatSessionsTable.$inferSelect;
