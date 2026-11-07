export type RarityTier = "Ultra rare" | "Very rare" | "Rare" | "Uncommon" | "Common";

export const RARITY_TIERS: RarityTier[] = ["Ultra rare", "Very rare", "Rare", "Uncommon", "Common"];

export function rarityTier(rate: number): RarityTier {
  if (rate < 5) return "Ultra rare";
  if (rate < 10) return "Very rare";
  if (rate < 20) return "Rare";
  if (rate < 50) return "Uncommon";
  return "Common";
}
