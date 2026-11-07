import { describe, expect, it } from "vitest";
import type { CSSProperties } from "react";
import { authBannerText } from "@/components/AuthBanner";
import { levelSpriteStyle } from "@/components/levelSprite";

const NOW = new Date("2026-11-08T12:00:00Z");
const daysAgo = (n: number, extraMs = 0) => new Date(NOW.getTime() - n * 86_400_000 - extraMs);

describe("authBannerText", () => {
  it("says the token expired", () => {
    expect(authBannerText("expired", daysAgo(3), NOW)).toBe("PSN token expired — update it in Settings");
  });

  it("asks to connect when no token was ever stored", () => {
    expect(authBannerText("missing", null, NOW)).toBe("Connect your PSN account in Settings");
  });

  it("warns once the token is more than 50 days old", () => {
    expect(authBannerText("valid", daysAgo(52), NOW)).toBe("PSN token is 52 days old — renew it in Settings");
  });

  it("stays silent at exactly 50 whole days, even a few hours over", () => {
    expect(authBannerText("valid", daysAgo(50), NOW)).toBeNull();
    expect(authBannerText("valid", daysAgo(50, 23 * 3_600_000), NOW)).toBeNull();
  });

  it("counts whole days (floor)", () => {
    expect(authBannerText("valid", daysAgo(51, 3_600_000), NOW)).toBe(
      "PSN token is 51 days old — renew it in Settings",
    );
  });

  it("stays silent for a valid token with no recorded date", () => {
    expect(authBannerText("valid", null, NOW)).toBeNull();
  });
});

describe("levelSpriteStyle", () => {
  const pos = (tier: number) => (levelSpriteStyle(tier) as CSSProperties).backgroundPosition;

  it("selects the sprite row of the tier", () => {
    expect(levelSpriteStyle(1)).toEqual({
      backgroundImage: "url(/icons/level-sprite.png)",
      backgroundSize: "100% 1000%",
      backgroundPosition: "0 0%",
    });
    expect(pos(10)).toBe("0 100%");
    expect(pos(6)).toBe(`0 ${(5 / 9) * 100}%`);
  });

  it("clamps the tier to 1..10", () => {
    expect(pos(0)).toBe("0 0%");
    expect(pos(-4)).toBe("0 0%");
    expect(pos(11)).toBe("0 100%");
  });
});
