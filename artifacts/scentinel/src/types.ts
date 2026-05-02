export interface FragranceNotes {
  top: string[];
  heart: string[];
  base: string[];
}

export interface Fragrance {
  id: string;
  name: string;
  house: string;
  year: number;
  concentration: string;
  accords: string[];
  notes: FragranceNotes;
  longevity: number;
  sillage: number;
  price_gbp: number;
}

export interface DupeResult {
  name: string;
  house: string;
  similarity_pct: number;
  price_gbp: number;
  price_delta: number;
  accords: string[];
}

export interface ContextPick {
  rank: number;
  name: string;
  house: string;
  reason: string;
  match_pct: number;
}

export interface ScoreBreakdown {
  accord_compatibility: number;
  community_longevity: number;
  batch_consistency: number;
  price_value: number;
}

export interface RiskFlag {
  level: "warn" | "info" | "ok";
  message: string;
}

export interface BlindBuyScore {
  overall_score: number;
  breakdown: ScoreBreakdown;
  verdict: "Strong buy" | "Buy" | "Try first" | "Avoid";
  risk_flags: RiskFlag[];
  recommendation: string;
}

export interface UserProfile {
  ownedFragrances: string[];
  budget: string | null;
}

export const SEEDED_FRAGRANCES = [
  "Creed Aventus",
  "Dior Sauvage EDP",
  "Bleu de Chanel EDP",
  "Tom Ford Oud Wood",
  "YSL Y EDP",
  "Parfums de Marly Layton",
  "Amouage Jubilation XXV",
  "Armaf Club de Nuit Intense Man",
  "Acqua di Gio Profondo",
  "Paco Rabanne Invictus Platinum",
  "Jo Malone Wood Sage & Sea Salt",
  "Maison Margiela Replica Jazz Club",
];

export const BUDGET_OPTIONS = [
  { value: "under_50", label: "Under £50" },
  { value: "50_150", label: "£50 – £150" },
  { value: "150_300", label: "£150 – £300" },
  { value: "no_limit", label: "No limit" },
];

export const ACCORD_COLORS: Record<string, string> = {
  fruity: "#e86c4f",
  woody: "#a0785a",
  smoky: "#7a7a7a",
  fresh: "#6bb8c9",
  citrus: "#e4c04a",
  spicy: "#c45c3a",
  lavender: "#9b87c4",
  vanilla: "#d4a96a",
  aromatic: "#7ba864",
  aquatic: "#4a9fb5",
  mineral: "#8a9aad",
  earthy: "#8c6f4e",
  oud: "#5c3d2e",
  resinous: "#9c7a3a",
  sweet: "#c4788a",
  fougere: "#5a8c6a",
  oriental: "#c4703c",
  floral: "#c48aaa",
  amber: "#c4923c",
};

export const LONGEVITY_LABELS: Record<number, string> = {
  1: "Poor",
  2: "Weak",
  3: "Moderate",
  4: "Long",
  5: "Extreme",
};

export const SILLAGE_LABELS: Record<number, string> = {
  1: "Intimate",
  2: "Soft",
  3: "Moderate",
  4: "Strong",
  5: "Enormous",
};
