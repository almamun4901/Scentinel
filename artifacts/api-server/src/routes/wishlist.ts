import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getAuth } from "@clerk/express";
import { db, wishlistsTable } from "@workspace/db";

const router = Router();

router.get("/wishlist", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.json([]);
    return;
  }
  try {
    const rows = await db
      .select()
      .from(wishlistsTable)
      .where(eq(wishlistsTable.userId, userId))
      .orderBy(wishlistsTable.addedAt);
    res.json(
      rows.map((r) => ({
        ...r.fragranceData,
        addedAt: r.addedAt.toISOString(),
        personalNote: r.personalNote,
      })),
    );
  } catch (err) {
    req.log.error({ err }, "Failed to get wishlist");
    res.status(500).json({ error: "Failed to get wishlist" });
  }
});

router.post("/wishlist", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const { fragrance, personalNote = "" } = req.body as {
    fragrance: Record<string, unknown>;
    personalNote?: string;
  };
  if (!fragrance?.id || !fragrance?.name) {
    res.status(400).json({ error: "Invalid fragrance data" });
    return;
  }
  try {
    await db
      .insert(wishlistsTable)
      .values({
        id: randomUUID(),
        userId,
        fragranceId: String(fragrance.id),
        fragranceName: String(fragrance.name),
        fragranceData: fragrance,
        personalNote,
      })
      .onConflictDoNothing();
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to add to wishlist");
    res.status(500).json({ error: "Failed to add to wishlist" });
  }
});

router.delete("/wishlist/:fragranceId", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const { fragranceId } = req.params;
  try {
    await db
      .delete(wishlistsTable)
      .where(
        and(
          eq(wishlistsTable.userId, userId),
          eq(wishlistsTable.fragranceId, fragranceId),
        ),
      );
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to remove from wishlist");
    res.status(500).json({ error: "Failed to remove from wishlist" });
  }
});

router.patch("/wishlist/:fragranceId", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const { fragranceId } = req.params;
  const { personalNote } = req.body as { personalNote: string };
  if (typeof personalNote !== "string") {
    res.status(400).json({ error: "personalNote must be a string" });
    return;
  }
  try {
    await db
      .update(wishlistsTable)
      .set({ personalNote })
      .where(
        and(
          eq(wishlistsTable.userId, userId),
          eq(wishlistsTable.fragranceId, fragranceId),
        ),
      );
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to update wishlist note");
    res.status(500).json({ error: "Failed to update wishlist note" });
  }
});

export default router;
