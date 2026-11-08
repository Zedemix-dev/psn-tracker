import { describe, expect, it } from "vitest";
import { gameQueryParams } from "@/components/game-query-string";

const base = { state: "all", platform: "all", q: "" } as const;

describe("gameQueryParams", () => {
  it("omits the default sort (lastTrophy)", () => {
    expect(gameQueryParams({ ...base, sort: "lastTrophy" }).toString()).toBe("");
  });

  it("writes sort=lastPlayed", () => {
    expect(gameQueryParams({ ...base, sort: "lastPlayed" }).toString()).toBe("sort=lastPlayed");
  });
});
