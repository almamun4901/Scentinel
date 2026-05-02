import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, userProfilesTable } from "@workspace/db";
import { SaveProfileBody } from "@workspace/api-zod";

const router = Router();

router.get("/profile", async (req, res) => {
  if (!req.isAuthenticated()) {
    // Return guest profile
    res.json({ ownedFragrances: [], budget: null });
    return;
  }
  const userId = req.user.id;
  try {
    const [profile] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, userId));
    if (!profile) {
      res.json({ ownedFragrances: [], budget: null });
      return;
    }
    res.json({ ownedFragrances: profile.ownedFragrances, budget: profile.budget });
  } catch (err) {
    req.log.error({ err }, "Failed to get profile");
    res.status(500).json({ error: "Failed to get profile" });
  }
});

router.put("/profile", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const parsed = SaveProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const userId = req.user.id;
  const { ownedFragrances, budget } = parsed.data;
  try {
    const [upserted] = await db
      .insert(userProfilesTable)
      .values({ userId, ownedFragrances, budget: budget ?? null })
      .onConflictDoUpdate({
        target: userProfilesTable.userId,
        set: { ownedFragrances, budget: budget ?? null, updatedAt: new Date() },
      })
      .returning();
    res.json({ ownedFragrances: upserted!.ownedFragrances, budget: upserted!.budget });
  } catch (err) {
    req.log.error({ err }, "Failed to save profile");
    res.status(500).json({ error: "Failed to save profile" });
  }
});

export default router;
