import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/src/db/client";
import { syncRuns, type TrophyType } from "@/src/db/schema";
import { computeMilestones, getMilestones, ordinal } from "@/src/stats/milestones";
import type { EarnedTrophy } from "@/src/stats/trophies";
import { insertTitle, insertTrophies } from "@/tests/fixtures/profile";
import { createTestDb } from "@/tests/helpers/db";

const NOW = new Date("2030-01-01T00:00:00Z");
const BASE = Date.UTC(2020, 0, 1);

function make(
  i: number,
  over: Partial<EarnedTrophy> & { sec?: number } = {},
): EarnedTrophy {
  const { sec = i, ...rest } = over;
  return {
    titleId: "T",
    trophyId: i,
    name: `T${i}`,
    detail: "",
    iconUrl: null,
    type: "bronze" as TrophyType,
    earnedAt: new Date(BASE + sec * 1000),
    earnedRate: null,
    gameName: "G",
    ...rest,
  };
}

const run = (n: number, start = 0) => Array.from({ length: n }, (_, k) => make(start + k));
const labels = (ms: ReturnType<typeof computeMilestones>) => ms.map((m) => m.label);

describe("computeMilestones", () => {
  it("returns nothing without trophies", () => {
    expect(computeMilestones([], NOW)).toEqual([]);
  });

  it("numbers same-second trophies with the platinum last", () => {
    const earned = [
      ...run(499),
      make(1000, { sec: 600, type: "platinum" }),
      make(900, { sec: 600, type: "silver" }),
    ];
    const ms = computeMilestones(earned, NOW);
    const m500 = ms.find((m) => m.label === "500th trophy")!;
    expect(m500.trophy.type).toBe("silver");
    const plat = ms.filter((m) => m.trophy.type === "platinum").map((m) => m.label);
    expect(plat).not.toContain("500th trophy");
    expect(plat).toEqual(["First platinum", "Latest platinum", "Fastest platinum"]);
  });

  it("emits one entry per label for a single platinum and orders newest first", () => {
    const ms = computeMilestones([make(1, { type: "platinum" }), make(2)], NOW);
    expect(labels(ms)).toEqual(["First trophy", "First platinum", "Latest platinum", "Fastest platinum"]);
    expect(ms.every((m) => m.trophy.trophyId === 1)).toBe(true);
  });

  it("labels the 75th and 225th platinum and the 1,337th trophy", () => {
    const plats = Array.from({ length: 225 }, (_, k) => make(k, { type: "platinum" }));
    const ms = computeMilestones([...plats, ...run(1200, 1000)], NOW);
    const all = labels(ms);
    expect(all).toContain("75th platinum");
    expect(all).toContain("225th platinum");
    expect(all).toContain("10th platinum");
    expect(all).toContain("1,337th trophy");
    expect(all).toContain("1,000th trophy");
    expect(all).not.toContain("60th platinum");
    // 225th platinum is also the latest platinum: both labels on one trophy, emission order kept
    const last = ms.filter((m) => m.trophy.trophyId === 224).map((m) => m.label);
    expect(last).toEqual(["Latest platinum", "225th platinum"]);
  });

  it("goes every 50 platinums after the 250th, and every 5,000 trophies after the 10,000th", () => {
    const plats = Array.from({ length: 400 }, (_, k) => make(k, { type: "platinum" }));
    const all = labels(computeMilestones([...plats, ...run(19_600, 1000)], NOW));
    for (const l of ["225th platinum", "250th platinum", "300th platinum", "350th platinum", "400th platinum"]) {
      expect(all).toContain(l);
    }
    for (const l of ["275th platinum", "325th platinum", "375th platinum"]) expect(all).not.toContain(l);
    for (const l of ["9,000th trophy", "10,000th trophy", "15,000th trophy", "20,000th trophy"]) {
      expect(all).toContain(l);
    }
    for (const l of ["11,000th trophy", "12,000th trophy", "14,000th trophy", "16,000th trophy"]) {
      expect(all).not.toContain(l);
    }
  });

  it("picks the fastest platinum by gap to the first trophy of the same game", () => {
    const earned = [
      make(1, { titleId: "A", sec: 0 }),
      make(2, { titleId: "A", sec: 1000, type: "platinum" }),
      make(3, { titleId: "B", sec: 2000 }),
      make(4, { titleId: "B", sec: 2060, type: "platinum" }),
    ];
    const fast = computeMilestones(earned, NOW).find((m) => m.label === "Fastest platinum")!;
    expect(fast.trophy.trophyId).toBe(4);
  });

  it("measures the fastest platinum from the exact earliest trophy of the game", () => {
    const at = (sec: number, ms: number) => new Date(BASE + sec * 1000 + ms);
    const earned = [
      make(1, { titleId: "A", earnedAt: at(0, 900) }),
      make(2, { titleId: "A", earnedAt: at(0, 100) }),
      make(3, { titleId: "A", earnedAt: at(1, 0), type: "platinum" }),
      make(4, { titleId: "B", earnedAt: at(10, 0) }),
      make(5, { titleId: "B", earnedAt: at(10, 500), type: "platinum" }),
    ];
    const fast = computeMilestones(earned, NOW).find((m) => m.label === "Fastest platinum")!;
    expect(fast.trophy.trophyId).toBe(5);
  });

  it("uses English ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111, 1337].map(ordinal)).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "101st", "111th", "1,337th",
    ]);
  });
});

describe("getMilestones", () => {
  let db: Db;
  beforeEach(async () => {
    db = await createTestDb();
    await insertTitle(db, { id: "A", defined: 2, earned: 2 });
    await insertTitle(db, { id: "H", defined: 1, earned: 1, hidden: true });
  });

  it("uses earned trophies of visible titles only", async () => {
    await insertTrophies(db, [
      { titleId: "A", trophyId: 1, earnedAt: new Date("2024-01-01T00:00:10Z") },
      { titleId: "A", trophyId: 2, earnedAt: new Date("2024-01-01T00:00:20Z"), type: "platinum" },
      { titleId: "H", trophyId: 1, earnedAt: new Date("2023-01-01T00:00:00Z") },
    ]);
    const ms = await getMilestones(db, NOW);
    const first = ms.find((m) => m.label === "First trophy")!;
    expect(first.trophy).toMatchObject({ titleId: "A", trophyId: 1, gameName: "Game A" });
  });

  it("keeps the result until a run ends, then sees new trophies", async () => {
    await insertTrophies(db, [{ titleId: "A", trophyId: 1, earnedAt: new Date("2024-01-01T00:00:10Z") }]);
    expect((await getMilestones(db, NOW)).find((m) => m.label === "First trophy")!.trophy.trophyId).toBe(1);
    await insertTrophies(db, [{ titleId: "A", trophyId: 2, earnedAt: new Date("2023-01-01T00:00:00Z") }]);
    expect((await getMilestones(db, NOW)).find((m) => m.label === "First trophy")!.trophy.trophyId).toBe(1);
    await db.insert(syncRuns).values({ kind: "daily", status: "success", finishedAt: new Date("2026-11-11T10:00:00Z") });
    expect((await getMilestones(db, NOW)).find((m) => m.label === "First trophy")!.trophy.trophyId).toBe(2);
  });
});
