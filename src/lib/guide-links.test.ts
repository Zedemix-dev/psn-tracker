import { describe, expect, it } from "vitest";
import { guideSearchName, powerPyxRoadmapUrl, psnProfilesGuidesUrl } from "./guide-links";

describe("guide links", () => {
  it("builds the PowerPyx roadmap search", () => {
    expect(powerPyxRoadmapUrl("Gran Turismo 7")).toBe("https://www.powerpyx.com/?s=Gran+Turismo+7+roadmap");
  });
  it("builds the PSNProfiles guides search", () => {
    expect(psnProfilesGuidesUrl("Gran Turismo 7")).toBe("https://psnprofiles.com/search/guides?q=Gran%20Turismo%207");
  });
  it("cleans the search name", () => {
    expect(guideSearchName("Assassin's Creed® Odyssey")).toBe("Assassin's Creed Odyssey");
    expect(guideSearchName("ASTRO’s PLAYROOM")).toBe("ASTRO’s PLAYROOM");
    expect(guideSearchName("  Tales  of Arise™ ")).toBe("Tales of Arise");
    expect(guideSearchName("13 Sentinels: Aegis Rim")).toBe("13 Sentinels: Aegis Rim");
  });
  it("round-trips an accented name through the PSNProfiles URL", () => {
    const url = psnProfilesGuidesUrl("Pokémon Legends: Arceus");
    expect(decodeURIComponent(url.split("?q=")[1])).toBe("Pokémon Legends: Arceus");
  });
});
