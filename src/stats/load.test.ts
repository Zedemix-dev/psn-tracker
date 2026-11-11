import { beforeEach, describe, expect, it, vi } from "vitest";
import * as images from "@/src/sync/images";
import type { Db } from "@/src/db/client";
import { insertTitle, insertTrophies } from "@/tests/fixtures/profile";
import { createTestDb } from "@/tests/helpers/db";
import { getStatsData } from "./load";

const NOW = new Date("2026-11-11T12:00:00Z");
/** 1 Oct 2026, 10:<m> UTC, i.e. 12:<m> in Paris. */
const at = (m: number) => new Date(Date.UTC(2026, 9, 1, 10, m));

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

/** Each platinum is 300 points, so level 10 (540 points) falls on the 2nd one. */
async function seedPlatinums(titleId: string, n: number, rate: number | null = 18.3) {
  await insertTrophies(
    db,
    Array.from({ length: n }, (_, i) => ({ titleId, trophyId: i, type: "platinum" as const, earnedAt: at(i), earnedRate: rate })),
  );
}

describe("getStatsData", () => {
  it("reads the image map once, or not at all when the page hands it over", async () => {
    const spy = vi.spyOn(images, "loadImageMap");
    await insertTitle(db, { id: "A", progress: 100 });
    await getStatsData(db, { hideZero: false, now: NOW });
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockClear();
    await getStatsData(db, { hideZero: false, now: NOW, imageMap: new Map() });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("assembles the trophies, the games and the levels", async () => {
    await insertTitle(db, { id: "A", progress: 100, publisher: "CE EUROPE LIMITED", genres: ["Action"], releaseDate: new Date(Date.UTC(2020, 5, 1)) });
    await insertTitle(db, { id: "B", progress: 50, platforms: ["PS4"] });
    await seedPlatinums("A", 3);
    const d = await getStatsData(db, { hideZero: false, now: NOW });
    expect(d.total).toBe(3);
    expect(d.totalPoints).toBe(900);
    expect(d.games).toBe(2);
    expect(d.completion.average).toBe(75);
    expect(d.platforms).toEqual({ PS5: 1, PS4: 1 });
    expect(d.publishers).toEqual([{ name: "Capcom", games: 1 }]);
    expect(d.noPublisher).toBe(1);
    expect(d.levels.map((l) => l.level)).toEqual([10]);
  });

  it("lists the levels newest first, with the game image and the rarity", async () => {
    await insertTitle(db, { id: "A", progress: 100 });
    await seedPlatinums("A", 3, 18.3);
    const d = await getStatsData(db, { hideZero: false, now: NOW });
    expect(d.levels).toHaveLength(1);
    expect(d.levels[0]).toMatchObject({
      key: "A:1",
      level: 10,
      tier: 1,
      earnedAtMs: at(1).getTime(),
      type: "platinum",
      gameId: "A",
      gameName: "Game A",
      gameSrc: "/icons/placeholder.svg",
      gameIsIcon: true,
      gameTileBg: null,
      date: "1 Oct 2026",
      time: "12:01:00",
      ratePct: "18.30%",
      rarity: "Rare",
    });
  });

  it("orders several levels newest first", async () => {
    await insertTitle(db, { id: "A", progress: 100 });
    await seedPlatinums("A", 40); // 12000 points
    const d = await getStatsData(db, { hideZero: false, now: NOW });
    const levels = d.levels.map((l) => l.level);
    expect(levels.length).toBeGreaterThan(1);
    expect(levels).toEqual([...levels].sort((a, b) => b - a));
    expect(d.levels[0].earnedAtMs).toBeGreaterThan(d.levels[levels.length - 1].earnedAtMs);
  });

  it("gives a null rate no rarity", async () => {
    await insertTitle(db, { id: "A", progress: 100 });
    await seedPlatinums("A", 3, null);
    const d = await getStatsData(db, { hideZero: false, now: NOW });
    expect(d.levels[0].ratePct).toBeNull();
    expect(d.levels[0].rarity).toBeNull();
  });

  it("leaves 0% games out of the game charts with hideZero", async () => {
    await insertTitle(db, { id: "A", progress: 100 });
    await insertTitle(db, { id: "Z", progress: 0 });
    await seedPlatinums("A", 3);
    const all = await getStatsData(db, { hideZero: false, now: NOW });
    const some = await getStatsData(db, { hideZero: true, now: NOW });
    expect([all.games, some.games]).toEqual([2, 1]);
    expect([all.completion.average, some.completion.average]).toEqual([50, 100]);
    expect(some.total).toBe(all.total);
  });

  it("leaves hidden titles out", async () => {
    await insertTitle(db, { id: "A", progress: 100 });
    await insertTitle(db, { id: "H", progress: 100, hidden: true });
    await seedPlatinums("H", 3);
    const d = await getStatsData(db, { hideZero: false, now: NOW });
    expect(d.games).toBe(1);
    expect(d.total).toBe(0);
    expect(d.levels).toEqual([]);
  });
});
