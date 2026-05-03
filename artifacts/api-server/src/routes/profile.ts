import { Router } from "express";
import { eq } from "drizzle-orm";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { getAuth } from "@clerk/express";
import { db, userProfilesTable } from "@workspace/db";
import { SaveProfileBody } from "@workspace/api-zod";
import { computeScentDNA } from "../lib/scent-dna.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Fragrance {
  id: string; name: string; house: string; year: number;
  concentration: string; accords: string[]; notes: { top: string[]; heart: string[]; base: string[] };
  longevity: number; sillage: number; price_usd: number; image_url?: string;
}
const fragrancesPath = join(__dirname, "../data/fragrance-data.json");
const allFragrances: Fragrance[] = JSON.parse(readFileSync(fragrancesPath, "utf-8"));

const router = Router();

router.get("/profile", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.json({ ownedFragrances: [], budget: null });
    return;
  }
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
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const parsed = SaveProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
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

// ─── GET /profile/scent-dna (T007) ───────────────────────────────────────────
router.get("/profile/scent-dna", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.json(null);
    return;
  }
  try {
    const [profile] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.userId, userId))
      .limit(1);

    if (!profile || !profile.ownedFragrances.length) {
      res.json(null);
      return;
    }

    const dna = computeScentDNA(profile.ownedFragrances, allFragrances);
    res.json(dna);
  } catch (err) {
    req.log.error({ err }, "Failed to compute scent DNA");
    res.status(500).json({ error: "Failed to compute scent DNA" });
  }
});

export default router;
