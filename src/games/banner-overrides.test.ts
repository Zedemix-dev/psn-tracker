import { describe, expect, it } from "vitest";
import { BANNER_OVERRIDES, bannerOverrideFor } from "@/src/games/banner-overrides";
import { gameKey } from "@/src/games/siblings";

const DAUNTLESS = "https://img.psnprofiles.com/hero/l/14795/05bf48f1-d893-41d8-b1f7-1ea0bfcc3bc0.jpg";

describe("bannerOverrideFor", () => {
  it("matches by game key", () => {
    expect(bannerOverrideFor("Dauntless")).toBe(DAUNTLESS);
    expect(bannerOverrideFor("DAUNTLESS™")).toBe(DAUNTLESS);
  });
  it("returns null for other games", () => {
    expect(bannerOverrideFor("Cyberpunk 2077")).toBeNull();
  });
  it("has the five games, keyed by gameKey", () => {
    expect(Object.keys(BANNER_OVERRIDES)).toHaveLength(5);
    for (const k of Object.keys(BANNER_OVERRIDES)) expect(k).toBe(gameKey(k));
  });
});
