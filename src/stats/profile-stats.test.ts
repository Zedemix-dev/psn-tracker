import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/src/db/client";
import { getProfileStats } from "@/src/stats/profile-stats";
import { insertPlayedGame, insertTitle, insertTrophies, type TitleSeed } from "@/tests/fixtures/profile";
import { createTestDb } from "@/tests/helpers/db";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

async function seedThree() {
  await insertTitle(db, { id: "A", defined: 10, earned: 10, playSeconds: 3600 });
  await insertTitle(db, { id: "B", defined: 36, earned: 0, playSeconds: 100 });
  await insertTitle(db, { id: "C", defined: 20, earned: 5, playSeconds: null });
  await insertPlayedGame(db, { id: "GA", titleIds: ["A"], playSeconds: 3600 });
  await insertPlayedGame(db, { id: "GB", titleIds: ["B"], playSeconds: 100 });
}

/** Two trophy lists of one played game: the sync gives each list the game's full time. */
async function seedSharedGame(a: TitleSeed, b: TitleSeed) {
  await insertTitle(db, { defined: 10, earned: 5, playSeconds: 3600, ...a });
  await insertTitle(db, { defined: 10, earned: 5, playSeconds: 3600, ...b });
  await insertPlayedGame(db, { id: "G", titleIds: [a.id, b.id], playSeconds: 3600 });
}

describe("getProfileStats", () => {
  it("aggregates all visible titles", async () => {
    await seedThree();
    const s = await getProfileStats(db, { hideZero: false });
    expect(s).toMatchObject({
      totalGames: 3,
      gamesCompleted: 1,
      completionRate: 22.73,
      unearned: 51,
      hoursSeconds: 3700,
    });
  });

  it("excludes 0% titles with hideZero", async () => {
    await seedThree();
    const s = await getProfileStats(db, { hideZero: true });
    expect(s).toMatchObject({ totalGames: 2, completionRate: 50, unearned: 15 });
  });

  it("never counts hidden titles", async () => {
    await seedThree();
    await insertTitle(db, { id: "H", defined: 100, earned: 100, hidden: true, playSeconds: 999 });
    await insertPlayedGame(db, { id: "GH", titleIds: ["H"], playSeconds: 999 });
    await insertTrophies(db, [{ titleId: "H", trophyId: 1, earnedAt: new Date("2020-01-01T00:00:00Z"), earnedRate: 1 }]);
    const s = await getProfileStats(db, { hideZero: false });
    expect(s).toMatchObject({ totalGames: 3, completionRate: 22.73, unearned: 51, hoursSeconds: 3700, averageRarity: 0, trophiesPerDay: 0 });
  });

  it("counts a played game mapped to two visible titles once", async () => {
    await seedSharedGame({ id: "A" }, { id: "B" });
    expect((await getProfileStats(db, { hideZero: false })).hoursSeconds).toBe(3600);
  });

  it("counts nothing for a played game whose linked titles are all hidden", async () => {
    await seedSharedGame({ id: "A", hidden: true }, { id: "B", hidden: true });
    expect((await getProfileStats(db, { hideZero: false })).hoursSeconds).toBe(0);
  });

  it("with hideZero, counts nothing for a played game whose only visible title is at 0%", async () => {
    await seedSharedGame({ id: "A", earned: 0 }, { id: "B", hidden: true });
    expect((await getProfileStats(db, { hideZero: true })).hoursSeconds).toBe(0);
    expect((await getProfileStats(db, { hideZero: false })).hoursSeconds).toBe(3600);
  });

  it("counts once a played game mapped to one hidden and one visible title", async () => {
    await seedSharedGame({ id: "A" }, { id: "B", hidden: true });
    expect((await getProfileStats(db, { hideZero: false })).hoursSeconds).toBe(3600);
  });

  it("ignores trophies without rarity in the average", async () => {
    await insertTitle(db, { id: "A", defined: 3, earned: 3 });
    const at = new Date("2024-01-01T00:00:00Z");
    await insertTrophies(db, [
      { titleId: "A", trophyId: 1, earnedAt: at, earnedRate: 10 },
      { titleId: "A", trophyId: 2, earnedAt: at, earnedRate: 20 },
      { titleId: "A", trophyId: 3, earnedAt: at, earnedRate: null },
    ]);
    expect((await getProfileStats(db, { hideZero: false })).averageRarity).toBe(15);
  });

  it("computes trophies per day from the oldest earnedAt, with a 1-day minimum", async () => {
    await insertTitle(db, { id: "A", defined: 10, earned: 10 });
    await insertTrophies(db, [{ titleId: "A", trophyId: 1, earnedAt: new Date("2024-01-01T00:00:00Z"), earnedRate: 5 }]);
    const s = await getProfileStats(db, { hideZero: false, now: new Date("2024-01-06T00:00:00Z") });
    expect(s.trophiesPerDay).toBe(2);
    const sameDay = await getProfileStats(db, { hideZero: false, now: new Date("2024-01-01T06:00:00Z") });
    expect(sameDay.trophiesPerDay).toBe(10);
  });

  it("returns zeros without data", async () => {
    expect(await getProfileStats(db, { hideZero: false })).toEqual({
      gamesCompleted: 0,
      totalGames: 0,
      completionRate: 0,
      averageRarity: 0,
      unearned: 0,
      trophiesPerDay: 0,
      hoursSeconds: 0,
    });
  });
});
