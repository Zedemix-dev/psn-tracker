export type RarityTier = "Ultra rare" | "Very rare" | "Rare" | "Uncommon" | "Common";

export const RARITY_TIERS: RarityTier[] = ["Ultra rare", "Very rare", "Rare", "Uncommon", "Common"];

/** [min, max) of each tier in percent; max null for Common. */
export const RARITY_RANGES: Record<RarityTier, [min: number, max: number | null]> = {
  "Ultra rare": [0, 5],
  "Very rare": [5, 10],
  Rare: [10, 20],
  Uncommon: [20, 50],
  Common: [50, null],
};

export function rarityTier(rate: number): RarityTier {
  return RARITY_TIERS.find((tier) => {
    const max = RARITY_RANGES[tier][1];
    return max === null || rate < max;
  })!;
}
