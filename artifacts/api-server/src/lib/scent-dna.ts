export interface ScentDNA {
  topAccords: string[];
  preferredHouses: string[];
  avgPrice: number;
  priceRange: "budget" | "mid" | "luxury" | "ultra-luxury";
  intensity: "light" | "moderate" | "bold";
  collectionSize: number;
  summary: string;
}

interface Fragrance {
  id: string;
  name: string;
  house: string;
  accords: string[];
  price_usd: number;
  sillage: number;
}

export function computeScentDNA(
  ownedNames: string[],
  allFragrances: Fragrance[],
): ScentDNA | null {
  if (!ownedNames.length) return null;

  const owned = allFragrances.filter((f) =>
    ownedNames.some(
      (o) =>
        f.name.toLowerCase() === o.toLowerCase() ||
        `${f.house} ${f.name}`.toLowerCase() === o.toLowerCase(),
    ),
  );

  if (!owned.length) return null;

  // Count accord occurrences
  const accordCounts: Record<string, number> = {};
  for (const f of owned) {
    for (const a of f.accords) {
      accordCounts[a] = (accordCounts[a] ?? 0) + 1;
    }
  }
  const topAccords = Object.entries(accordCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([accord]) => accord);

  // Count house occurrences
  const houseCounts: Record<string, number> = {};
  for (const f of owned) {
    houseCounts[f.house] = (houseCounts[f.house] ?? 0) + 1;
  }
  const preferredHouses = Object.entries(houseCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([house]) => house);

  const avgPrice = Math.round(
    owned.reduce((sum, f) => sum + f.price_usd, 0) / owned.length,
  );

  const priceRange: ScentDNA["priceRange"] =
    avgPrice < 60
      ? "budget"
      : avgPrice < 150
        ? "mid"
        : avgPrice < 350
          ? "luxury"
          : "ultra-luxury";

  const avgSillage = owned.reduce((sum, f) => sum + f.sillage, 0) / owned.length;
  const intensity: ScentDNA["intensity"] =
    avgSillage < 2.3 ? "light" : avgSillage < 3.3 ? "moderate" : "bold";

  const summary =
    `${owned.length}-piece collection leaning ${topAccords.slice(0, 3).join(", ")}` +
    (preferredHouses.length
      ? `; favouring ${preferredHouses.slice(0, 2).join(" and ")}`
      : "") +
    `; avg spend ~$${avgPrice} (${priceRange}); ${intensity} projection preference`;

  return {
    topAccords,
    preferredHouses,
    avgPrice,
    priceRange,
    intensity,
    collectionSize: owned.length,
    summary,
  };
}
