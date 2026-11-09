import { describe, expect, it } from "vitest";
import { gameQueryParams } from "@/components/game-query-string";

const base = { state: "all", platform: "all", q: "", unobtainable: "off" } as const;

describe("gameQueryParams", () => {
  it("omits the default sort (lastTrophy)", () => {
    expect(gameQueryParams({ ...base, sort: "lastTrophy" }).toString()).toBe("");
  });

  it("writes sort=lastPlayed", () => {
    expect(gameQueryParams({ ...base, sort: "lastPlayed" }).toString()).toBe("sort=lastPlayed");
  });

  it("writes unobtainable when it is not off", () => {
    expect(gameQueryParams({ ...base, sort: "lastTrophy", unobtainable: "with" }).toString()).toBe("unobtainable=with");
    expect(gameQueryParams({ ...base, sort: "lastTrophy", unobtainable: "without" }).toString()).toBe("unobtainable=without");
    expect(gameQueryParams({ ...base, sort: "lastTrophy", unobtainable: "off" }).toString()).toBe("");
  });
});
