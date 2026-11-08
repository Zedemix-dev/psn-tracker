import { describe, expect, it } from "vitest";
import { RARITY_TIERS, rarityTier } from "@/src/lib/rarity";

describe("rarity", () => {
  it("maps rarity boundaries", () => {
    expect(rarityTier(4.99)).toBe("Ultra rare");  expect(rarityTier(5)).toBe("Very rare");
    expect(rarityTier(10)).toBe("Rare");          expect(rarityTier(20)).toBe("Uncommon");
    expect(rarityTier(49.99)).toBe("Uncommon");   expect(rarityTier(50)).toBe("Common");
  });
  it("lists tiers rarest first", () => {
    expect(RARITY_TIERS).toEqual(["Ultra rare", "Very rare", "Rare", "Uncommon", "Common"]);
  });
});
