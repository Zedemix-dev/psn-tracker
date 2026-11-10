import { describe, expect, it } from "vitest";
import { RARITY_RANGES, RARITY_TIERS, rarityTier } from "@/src/lib/rarity";

describe("rarity", () => {
  it("maps rarity boundaries", () => {
    expect(rarityTier(4.99)).toBe("Ultra rare");  expect(rarityTier(5)).toBe("Very rare");
    expect(rarityTier(10)).toBe("Rare");          expect(rarityTier(20)).toBe("Uncommon");
    expect(rarityTier(49.99)).toBe("Uncommon");   expect(rarityTier(50)).toBe("Common");
  });
  it("lists tiers rarest first", () => {
    expect(RARITY_TIERS).toEqual(["Ultra rare", "Very rare", "Rare", "Uncommon", "Common"]);
  });
  it("agrees with rarityTier at every bound", () => {
    for (const tier of RARITY_TIERS) {
      const [min, max] = RARITY_RANGES[tier];
      expect(rarityTier(min)).toBe(tier);
      if (max !== null) expect(rarityTier(max - 0.01)).toBe(tier);
    }
  });
});
