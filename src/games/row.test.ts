import { describe, expect, it } from "vitest";
import type { GameTitle } from "@/src/games/row";
import { gameStatus, progressRank, toGameRow } from "@/src/games/row";

describe("gameStatus", () => {
  it("covers the four statuses", () => {
    expect(gameStatus({ earnedPlatinum: 1, definedPlatinum: 1, progress: 50 })).toBe("plat-earned");
    expect(gameStatus({ earnedPlatinum: 0, definedPlatinum: 1, progress: 50 })).toBe("plat-missing");
    expect(gameStatus({ earnedPlatinum: 0, definedPlatinum: 0, progress: 100 })).toBe("complete");
    expect(gameStatus({ earnedPlatinum: 0, definedPlatinum: 0, progress: 80 })).toBe("incomplete");
  });
});

describe("progressRank", () => {
  it.each([
    [0, "F"],
    [1, "E"],
    [19, "E"],
    [20, "D"],
    [39, "D"],
    [40, "C"],
    [59, "C"],
    [60, "B"],
    [79, "B"],
    [80, "A"],
    [99, "A"],
    [100, "S"],
  ])("%i -> %s", (progress, rank) => {
    expect(progressRank(progress)).toBe(rank);
  });
});

const title = (over: Partial<GameTitle> = {}): GameTitle => ({
  npCommunicationId: "NPWR1",
  npServiceName: "trophy",
  name: "Game",
  iconUrl: "https://img/icon.png",
  coverUrl: "https://img/cover.png",
  platforms: ["PSVITA", "PS5", "PS4"],
  trophySetVersion: "1.00",
  hasTrophyGroups: false,
  definedPlatinum: 1,
  definedGold: 2,
  definedSilver: 3,
  definedBronze: 4,
  earnedPlatinum: 1,
  earnedGold: 1,
  earnedSilver: 0,
  earnedBronze: 2,
  progress: 40,
  hidden: false,
  lastTrophyAt: new Date("2024-03-02T10:00:00Z"),
  psnLastUpdatedAt: null,
  firstTrophyAt: null,
  playSeconds: 7200,
  playCount: null,
  lastPlayedAt: new Date("2024-03-05T10:00:00Z"),
  syncedAt: null,
  groupsCheckedAt: null,
  conceptId: null,
  bannerUrl: null,
  logoUrl: null,
  publisher: null,
  genres: null,
  releaseDate: null,
  catalogCheckedAt: null,
  unobtainableCount: 0,
  unobtainableNote: null,
  ...over,
});

describe("toGameRow", () => {
  it("maps counts, platforms, cover and the played line", () => {
    const row = toGameRow(title(), new Map([["https://img/cover.png", { path: "psn/c.png", thumb: null, tileBg: null }]]), new Map());
    expect(row).toEqual({
      id: "NPWR1",
      name: "Game",
      platforms: ["PS4", "PS5"],
      coverSrc: "/media/psn/c.png",
      coverIsIcon: false,
      earnedTotal: 4,
      definedTotal: 10,
      counts: { platinum: [1, 1], gold: [1, 2], silver: [0, 3], bronze: [2, 4] },
      progress: 40,
      rank: "C",
      lastPlayedLine: "Last played 5 Mar 2024 | 2h 00m played",
      status: "plat-earned",
      unobtainable: null,
    });
    expect(JSON.parse(JSON.stringify(row))).toEqual(row);
  });

  it("describes the unobtainable trophies, with the note as plain text", () => {
    const row = toGameRow(
      title({
        unobtainableCount: 7,
        definedPlatinum: 1,
        definedGold: 5,
        definedSilver: 15,
        definedBronze: 20,
        unobtainableNote: "Closed: [more](https://x.dev)",
      }),
      new Map(),
      new Map(),
    );
    expect(row.definedTotal).toBe(41);
    expect(row.unobtainable).toEqual({ label: "7 unobtainable trophies", note: "Closed: more" });
  });

  it("says all trophies when every one is marked, and has no note when empty", () => {
    const row = toGameRow(title({ unobtainableCount: 10, unobtainableNote: "" }), new Map(), new Map());
    expect(row.unobtainable).toEqual({ label: "All 10 trophies are unobtainable", note: null });
  });

  it("has no unobtainable data when the count is 0", () => {
    const row = toGameRow(title({ unobtainableCount: 0, unobtainableNote: "stale" }), new Map(), new Map());
    expect(row.unobtainable).toBeNull();
  });

  it("falls back to the icon without cover and to the last trophy date without play data", () => {
    const row = toGameRow(
      title({ coverUrl: null, lastPlayedAt: null, playSeconds: null }),
      new Map(),
      new Map(),
    );
    expect(row.coverIsIcon).toBe(true);
    expect(row.coverSrc).toBe("/icons/placeholder.svg");
    expect(row.lastPlayedLine).toBe("Last played 2 Mar 2024");
  });
});
