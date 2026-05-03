import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getAuth } from "@clerk/express";
import { db, chatSessionsTable } from "@workspace/db";
import type { StoredMessage } from "@workspace/db";

const router = Router();

router.get("/chat-sessions", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.json([]);
    return;
  }
  const limit = Math.min(Number(req.query.limit ?? 20), 50);
  try {
    const rows = await db
      .select({
        id: chatSessionsTable.id,
        title: chatSessionsTable.title,
        createdAt: chatSessionsTable.createdAt,
        updatedAt: chatSessionsTable.updatedAt,
        messageCount: chatSessionsTable.messages,
      })
      .from(chatSessionsTable)
      .where(eq(chatSessionsTable.userId, userId))
      .orderBy(desc(chatSessionsTable.updatedAt))
      .limit(limit);
    res.json(
      rows.map((r) => ({
        id: r.id,
        title: r.title,
        messageCount: Array.isArray(r.messageCount) ? r.messageCount.length : 0,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    );
  } catch (err) {
    req.log.error({ err }, "Failed to list chat sessions");
    res.status(500).json({ error: "Failed to list chat sessions" });
  }
});

router.get("/chat-sessions/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    const [row] = await db
      .select()
      .from(chatSessionsTable)
      .where(eq(chatSessionsTable.id, req.params.id))
      .limit(1);

    if (!row || row.userId !== userId) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json({
      id: row.id,
      title: row.title,
      messages: row.messages,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get chat session");
    res.status(500).json({ error: "Failed to get chat session" });
  }
});

router.post("/chat-sessions", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const { title = "New conversation" } = req.body as { title?: string };
  try {
    const id = randomUUID();
    const now = new Date();
    const [row] = await db
      .insert(chatSessionsTable)
      .values({ id, userId, title, messages: [], createdAt: now, updatedAt: now })
      .returning();
    res.json({
      id: row!.id,
      title: row!.title,
      messages: [],
      createdAt: row!.createdAt.toISOString(),
      updatedAt: row!.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create chat session");
    res.status(500).json({ error: "Failed to create chat session" });
  }
});

router.patch("/chat-sessions/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const { messages, title } = req.body as {
    messages?: StoredMessage[];
    title?: string;
  };
  try {
    const [existing] = await db
      .select({ userId: chatSessionsTable.userId })
      .from(chatSessionsTable)
      .where(eq(chatSessionsTable.id, req.params.id))
      .limit(1);

    if (!existing || existing.userId !== userId) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const updates: Partial<typeof chatSessionsTable.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (messages !== undefined) updates.messages = messages;
    if (title !== undefined) updates.title = title;

    await db
      .update(chatSessionsTable)
      .set(updates)
      .where(eq(chatSessionsTable.id, req.params.id));

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to update chat session");
    res.status(500).json({ error: "Failed to update chat session" });
  }
});

router.delete("/chat-sessions/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    const [existing] = await db
      .select({ userId: chatSessionsTable.userId })
      .from(chatSessionsTable)
      .where(eq(chatSessionsTable.id, req.params.id))
      .limit(1);

    if (!existing || existing.userId !== userId) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    await db
      .delete(chatSessionsTable)
      .where(eq(chatSessionsTable.id, req.params.id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete chat session");
    res.status(500).json({ error: "Failed to delete chat session" });
  }
});

export default router;
