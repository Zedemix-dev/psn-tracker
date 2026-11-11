import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/src/db/client";
import { titles, trophies } from "@/src/db/schema";
import {
  advisorScope,
  countAdvisorTrophies,
  getIncompleteGames,
  queryAdvisor,
  type AdvisorRow,
} from "@/src/trophy-advisor/load";
import {
  ADVISOR_SORTS,
  DEFAULT_ADVISOR_QUERY,
  type AdvisorQuery,
  type AdvisorScope,
} from "@/src/trophy-advisor/query";
import { LOG_MAX, LOG_ORDERS } from "@/src/trophy-log/query";
import { insertGroup, insertTitle, insertTrophies, type TrophySeed } from "@/tests/fixtures/profile";
import { createTestDb } from "@/tests/helpers/db";

const ALL = { offset: 0, limit: LOG_MAX };
const OFF: AdvisorScope = { hideZero: false, hideUnobtainable: false, dlc: "all" };

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

const list = (over: Partial<AdvisorQuery> = {}, scope: Partial<AdvisorScope> = {}, paging = ALL) =>
  queryAdvisor(db, { ...DEFAULT_ADVISOR_QUERY, ...over }, { ...OFF, ...scope }, paging);
const keys = (rows: AdvisorRow[]) => rows.map((r) => r.key);
const keysOf = async (over: Partial<AdvisorQuery> = {}, scope: Partial<AdvisorScope> = {}) =>
  keys((await list(over, scope)).items);

describe("queryAdvisor", () => {
  it("lists unearned trophies of visible titles only", async () => {
    await insertTitle(db, { id: "A" });
    await insertTitle(db, { id: "H", hidden: true });
    await insertTrophies(db, [
      { titleId: "A", trophyId: 1, earnedRate: 10 },
      { titleId: "A", trophyId: 2, earnedRate: 20, earnedAt: new Date() },
      { titleId: "H", trophyId: 1, earnedRate: 30 },
    ]);
    const { items, total } = await list();
    expect(keys(items)).toEqual(["A:1"]);
    expect(total).toBe(1);
    expect(await countAdvisorTrophies(db, OFF)).toBe(1);
  });

  it("sorts by rarity, most common first, unknown rarity last in both directions", async () => {
    await insertTitle(db, { id: "A" });
    await insertTrophies(db, [
      { titleId: "A", trophyId: 1, earnedRate: 10.5 },
      { titleId: "A", trophyId: 2, earnedRate: null },
      { titleId: "A", trophyId: 3, earnedRate: 2 },
      { titleId: "A", trophyId: 4, earnedRate: 80 },
    ]);
    expect(await keysOf({ sort: "rarity", order: "desc" })).toEqual(["A:4", "A:1", "A:3", "A:2"]);
    expect(await keysOf({ sort: "rarity", order: "asc" })).toEqual(["A:3", "A:1", "A:4", "A:2"]);
  });

  it("sorts alphabetically without case, accents or leading punctuation", async () => {
    await insertTitle(db, { id: "A" });
    const names = [" Journeyman", '"A hero"', "À On", "apple", "Zebra"];
    await insertTrophies(db, names.map((name, i) => ({ titleId: "A", trophyId: i + 1, name })));
    const asc = ['"A hero"', "À On", "apple", " Journeyman", "Zebra"];
    const got = async (order: "asc" | "desc") =>
      (await list({ sort: "alphabetical", order })).items.map((r) => r.name);
    expect(await got("asc")).toEqual(asc);
    expect(await got("desc")).toEqual([...asc].reverse());
  });

  it("breaks ties by game name, list id, then trophy order, in both directions", async () => {
    await insertTitle(db, { id: "Z1", name: "Beta" });
    await insertTitle(db, { id: "B2", name: "alpha" });
    await insertTitle(db, { id: "A1", name: "alpha" });
    await insertTrophies(db, [
      { titleId: "Z1", trophyId: 1, name: "Same", earnedRate: 5 },
      { titleId: "B2", trophyId: 2, name: "same", earnedRate: 5 },
      { titleId: "B2", trophyId: 1, name: "same", earnedRate: 5 },
      { titleId: "A1", trophyId: 1, name: "SAME", earnedRate: 5 },
    ]);
    const expected = ["A1:1", "B2:1", "B2:2", "Z1:1"];
    for (const order of LOG_ORDERS) {
      expect(await keysOf({ sort: "rarity", order })).toEqual(expected);
      expect(await keysOf({ sort: "alphabetical", order })).toEqual(expected);
    }
  });

  it("filters by platform, rarity and type", async () => {
    await insertTitle(db, { id: "P4", platforms: ["PS3", "PS4"] });
    await insertTitle(db, { id: "P5", platforms: ["PS5"] });
    await insertTrophies(db, [
      { titleId: "P4", trophyId: 1, type: "gold", earnedRate: 5 },
      { titleId: "P5", trophyId: 1, type: "silver", earnedRate: 50 },
      { titleId: "P5", trophyId: 2, earnedRate: null },
      { titleId: "P5", trophyId: 3, earnedRate: 49.99 },
      { titleId: "P4", trophyId: 0, type: "platinum", earnedRate: 4.99 },
    ]);
    expect(await keysOf({ platform: "PS4" })).toEqual(["P4:1", "P4:0"]);
    expect(await keysOf({ platform: "PS5" })).toEqual(["P5:1", "P5:3", "P5:2"]);
    expect(await keysOf({ rarity: "ultra-rare" })).toEqual(["P4:0"]);
    expect(await keysOf({ rarity: "very-rare" })).toEqual(["P4:1"]);
    expect(await keysOf({ rarity: "uncommon" })).toEqual(["P5:3"]);
    expect(await keysOf({ rarity: "common" })).toEqual(["P5:1"]);
    expect(await keysOf({ type: "bronze" })).toEqual(["P5:3", "P5:2"]);
    expect(await keysOf({ type: "platinum" })).toEqual(["P4:0"]);
    expect(await keysOf({ platform: "PS5", rarity: "uncommon", type: "bronze" })).toEqual(["P5:3"]);
    expect((await list({ type: "gold" })).total).toBe(1);
  });

  it("hides unobtainable trophies", async () => {
    await insertTitle(db, { id: "A" });
    await insertTrophies(db, [
      { titleId: "A", trophyId: 1, earnedRate: 10 },
      { titleId: "A", trophyId: 2, earnedRate: 20, unobtainable: true },
    ]);
    expect(await keysOf({}, { hideUnobtainable: true })).toEqual(["A:1"]);
    expect((await list({}, { hideUnobtainable: true })).total).toBe(1);
    expect(await keysOf()).toEqual(["A:2", "A:1"]);
  });

  it("hides DLC trophies with dlc 'hide' and keeps only them with 'only'", async () => {
    await insertTitle(db, { id: "A" });
    await insertGroup(db, { titleId: "A", groupId: "001", name: "Expansion" });
    await insertTrophies(db, [
      { titleId: "A", trophyId: 1, earnedRate: 10 },
      { titleId: "A", trophyId: 2, groupId: "001", earnedRate: 20 },
    ]);
    expect(await keysOf({}, { dlc: "hide" })).toEqual(["A:1"]);
    const only = await list({}, { dlc: "only" });
    expect(keys(only.items)).toEqual(["A:2"]);
    expect(only.total).toBe(1);
    expect(only.items[0].dlc).toBe("Expansion");
    expect((await list()).items.map((r) => r.dlc)).toEqual(["Expansion", null]);
  });

  it("drops 0% games with hideZero", async () => {
    await insertTitle(db, { id: "Z", progress: 0 });
    await insertTitle(db, { id: "P", progress: 5 });
    await insertTrophies(db, [
      { titleId: "Z", trophyId: 1 },
      { titleId: "P", trophyId: 1 },
    ]);
    expect(await keysOf({}, { hideZero: true })).toEqual(["P:1"]);
    expect(await countAdvisorTrophies(db, { ...OFF, hideZero: true })).toBe(1);
  });

  const sortsAndOrders = ADVISOR_SORTS.flatMap((sort) => LOG_ORDERS.map((order) => [sort, order] as const));
  it.each(sortsAndOrders)("pages of 2 cover the list with no duplicate or gap: %s %s", async (sort, order) => {
    await insertTitle(db, { id: "A", name: "Same" });
    await insertTitle(db, { id: "B", name: "Same" });
    const seeds: TrophySeed[] = [];
    for (const titleId of ["A", "B"]) {
      for (let trophyId = 1; trophyId <= 4; trophyId++) {
        if (titleId === "B" && trophyId === 4) continue;
        seeds.push({ titleId, trophyId, name: "Same", earnedRate: 7 });
      }
    }
    await insertTrophies(db, seeds);
    const query = { sort, order };
    const all = keys((await list(query)).items);
    expect(all).toHaveLength(7);
    const paged: string[] = [];
    for (let offset = 0; offset < 8; offset += 2) {
      paged.push(...keys((await list(query, {}, { offset, limit: 2 })).items));
    }
    expect(paged).toEqual(all);
    expect(new Set(all).size).toBe(7);
  });

  it("gives the counter only to a trophy with a target and a progress", async () => {
    await insertTitle(db, { id: "A" });
    await insertTrophies(db, [
      { titleId: "A", trophyId: 1 },
      { titleId: "A", trophyId: 2 },
      { titleId: "A", trophyId: 3 },
      { titleId: "A", trophyId: 4 },
    ]);
    const set = (trophyId: number, progress: number | null, progressTarget: number | null) =>
      db.update(trophies).set({ progress, progressTarget }).where(eq(trophies.trophyId, trophyId));
    await set(1, 3626, 5000);
    await set(2, 0, 4);
    await set(3, null, 4);
    await set(4, null, null);
    const items = (await list({ sort: "alphabetical" })).items;
    expect(Object.fromEntries(items.map((r) => [r.key, r.counter]))).toEqual({
      "A:1": "3,626/5,000",
      "A:2": "0/4",
      "A:3": null,
      "A:4": null,
    });
  });

  it("gives the cause of an unobtainable trophy in plain text", async () => {
    await insertTitle(db, { id: "A" });
    await insertTrophies(db, [
      { titleId: "A", trophyId: 1, unobtainable: true },
      { titleId: "A", trophyId: 2 },
    ]);
    await db
      .update(titles)
      .set({ unobtainableNote: "Servers closed, see [the guide](https://example.com/g)." })
      .where(eq(titles.npCommunicationId, "A"));
    const byKey = Object.fromEntries((await list()).items.map((r) => [r.key, r]));
    expect(byKey["A:1"].unobtainable).toBe(true);
    expect(byKey["A:1"].unobtainableNote).toBe("Servers closed, see the guide.");
    expect(byKey["A:2"].unobtainable).toBe(false);
    expect(byKey["A:2"].unobtainableNote).toBeNull();
  });

  it("builds the scope from the settings", () => {
    expect(advisorScope({ hideZero: true, advisorHideUnobtainable: false, advisorDlc: "only" })).toEqual({
      hideZero: true,
      hideUnobtainable: false,
      dlc: "only",
    });
  });
});

describe("getIncompleteGames", () => {
  async function seedGames() {
    await insertTitle(db, { id: "GT", name: "Gran Turismo", defined: 8, progress: 40 });
    await insertTitle(db, { id: "MH", name: "Marvel Heroes", defined: 4, progress: 10 });
    await insertTitle(db, { id: "NI", name: "Nioh", defined: 5, progress: 30 });
    await insertTitle(db, { id: "Done", name: "Done", defined: 1, earned: 1, progress: 100 });
    await insertGroup(db, { titleId: "NI", groupId: "001", name: "DLC" });
    await insertTrophies(db, [
      // Gran Turismo: 6 left, 4 of them unobtainable
      ...[1, 2].map((trophyId): TrophySeed => ({ titleId: "GT", trophyId })),
      ...[3, 4, 5, 6].map((trophyId): TrophySeed => ({ titleId: "GT", trophyId, unobtainable: true })),
      { titleId: "GT", trophyId: 7, earnedAt: new Date() },
      // Marvel Heroes: all 4 left are unobtainable
      ...[1, 2, 3, 4].map((trophyId): TrophySeed => ({ titleId: "MH", trophyId, unobtainable: true })),
      // Nioh: 2 base, 1 DLC
      { titleId: "NI", trophyId: 1 },
      { titleId: "NI", trophyId: 2 },
      { titleId: "NI", trophyId: 3, groupId: "001" },
      { titleId: "Done", trophyId: 1, earnedAt: new Date() },
    ]);
    await db
      .update(titles)
      .set({ unobtainableCount: 4, unobtainableNote: "Gone, [why](https://x.test/w)" })
      .where(eq(titles.npCommunicationId, "GT"));
    await db.update(titles).set({ unobtainableCount: 4 }).where(eq(titles.npCommunicationId, "MH"));
  }
  const left = async (scope: Partial<AdvisorScope> = {}) =>
    (await getIncompleteGames(db, { ...OFF, ...scope })).map((g) => [g.id, g.left]);

  it("orders by trophies left, then game name, then list id", async () => {
    await seedGames();
    expect(await left()).toEqual([
      ["GT", 6],
      ["MH", 4],
      ["NI", 3],
    ]);
    // Three more games with 3 left, like Nioh: by name without case, then by list id.
    await insertTitle(db, { id: "B2", name: "Alpha" });
    await insertTitle(db, { id: "A2", name: "alpha" });
    await insertTitle(db, { id: "C2", name: "Zeta" });
    await insertTrophies(
      db,
      ["B2", "A2", "C2"].flatMap((titleId) => [1, 2, 3].map((trophyId): TrophySeed => ({ titleId, trophyId }))),
    );
    expect((await left()).slice(2)).toEqual([
      ["A2", 3],
      ["B2", 3],
      ["NI", 3],
      ["C2", 3],
    ]);
  });

  it("counts DLC by default", async () => {
    await seedGames();
    expect(await left()).toContainEqual(["NI", 3]);
  });

  it("applies hideUnobtainable: a game with only unobtainable trophies left is gone, another goes from 6 to 2", async () => {
    await seedGames();
    expect(await left({ hideUnobtainable: true })).toEqual([
      ["NI", 3],
      ["GT", 2],
    ]);
  });

  it("applies dlc 'hide' and 'only' the same way", async () => {
    await seedGames();
    expect(await left({ dlc: "hide" })).toEqual([
      ["GT", 6],
      ["MH", 4],
      ["NI", 2],
    ]);
    expect(await left({ dlc: "only" })).toEqual([["NI", 1]]);
  });

  it("agrees with the list: the sum of left equals countAdvisorTrophies", async () => {
    await seedGames();
    for (const hideUnobtainable of [false, true]) {
      for (const dlc of ["all", "hide", "only"] as const) {
        const scope = { ...OFF, hideUnobtainable, dlc };
        const sum = (await getIncompleteGames(db, scope)).reduce((n, g) => n + g.left, 0);
        expect(sum, JSON.stringify(scope)).toBe(await countAdvisorTrophies(db, scope));
        expect(sum).toBe((await queryAdvisor(db, DEFAULT_ADVISOR_QUERY, scope, ALL)).total);
      }
    }
  });

  it("marks a game only while counted unobtainable trophies remain", async () => {
    await seedGames();
    const games = async (scope: Partial<AdvisorScope> = {}) =>
      Object.fromEntries((await getIncompleteGames(db, { ...OFF, ...scope })).map((g) => [g.id, g]));
    const all = await games();
    expect(all.GT.unobtainable).toEqual({ label: "4 unobtainable trophies", note: "Gone, why" });
    expect(all.MH.unobtainable).toEqual({ label: "All 4 trophies are unobtainable", note: null });
    expect(all.NI.unobtainable).toBeNull();
    expect((await games({ hideUnobtainable: true })).GT.unobtainable).toBeNull();
    // Hiding DLC leaves GT's 4 unobtainable trophies: still marked.
    expect((await games({ dlc: "hide" })).GT.unobtainable?.label).toBe("4 unobtainable trophies");
  });

  it("gives the game's PSN progress, rank and platforms, whatever the settings", async () => {
    await seedGames();
    const [first] = await getIncompleteGames(db, OFF);
    expect(first).toMatchObject({ id: "GT", name: "Gran Turismo", progress: 40, rank: "C", platforms: ["PS5"] });
    const [nioh] = await getIncompleteGames(db, { ...OFF, dlc: "only" });
    expect(nioh).toMatchObject({ id: "NI", progress: 30, rank: "D" });
  });

  it("skips hidden games", async () => {
    await insertTitle(db, { id: "H", hidden: true });
    await insertTrophies(db, [{ titleId: "H", trophyId: 1 }]);
    expect(await left()).toEqual([]);
  });

  it("is empty on a profile with nothing left", async () => {
    await insertTitle(db, { id: "A", defined: 1, earned: 1 });
    await insertTrophies(db, [{ titleId: "A", trophyId: 1, earnedAt: new Date() }]);
    expect(await getIncompleteGames(db, OFF)).toEqual([]);
  });
});
