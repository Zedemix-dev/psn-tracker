import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/src/db/client";
import { images, titles, trophies, type TrophyType } from "@/src/db/schema";
import { toGameRow } from "@/src/games/row";
import { loadSiblingIndex } from "@/src/games/siblings";
import { compareEarnedOrder } from "@/src/lib/earned-order";
import { loadImageMap } from "@/src/sync/images";
import { countLoggedTrophies, queryTrophyLog, type LogRow } from "@/src/trophy-log/load";
import { DEFAULT_LOG_QUERY, LOG_MAX, LOG_ORDERS, LOG_SORTS, type LogQuery } from "@/src/trophy-log/query";
import { insertGroup, insertTitle, insertTrophies } from "@/tests/fixtures/profile";
import { createTestDb } from "@/tests/helpers/db";

const ALL = { offset: 0, limit: LOG_MAX };
/** 4 Nov 2026 23:16:<s>.<ms> UTC, i.e. 00:16:<s> on 5 Nov in Paris. */
const at = (s: number, ms = 0) => new Date(Date.UTC(2026, 10, 4, 23, 16, s, ms));

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

const log = (over: Partial<LogQuery> = {}, paging = ALL) => queryTrophyLog(db, { ...DEFAULT_LOG_QUERY, ...over }, paging);
const keys = (rows: LogRow[]) => rows.map((r) => r.key);
const keysOf = async (over: Partial<LogQuery>) => keys((await log(over)).items);

describe("queryTrophyLog", () => {
  it("numbers every earned trophy like the milestones", async () => {
    for (const id of ["A", "B", "x", "Y"]) await insertTitle(db, { id });
    const seeds: { titleId: string; trophyId: number; type: TrophyType; earnedAt: Date }[] = [
      { titleId: "A", trophyId: 1, type: "bronze", earnedAt: at(37, 900) },
      // Same second as A:1 with earlier milliseconds: the second counts, not the milliseconds.
      { titleId: "B", trophyId: 1, type: "bronze", earnedAt: at(37, 100) },
      // A platinum and a gold at the same second: the platinum comes last.
      { titleId: "A", trophyId: 0, type: "platinum", earnedAt: at(37, 50) },
      { titleId: "A", trophyId: 5, type: "gold", earnedAt: at(37, 500) },
      { titleId: "B", trophyId: 2, type: "silver", earnedAt: at(36, 999) },
      // Same second and trophyId: code-unit order of the list id puts "Y" before "x".
      { titleId: "x", trophyId: 3, type: "bronze", earnedAt: at(38) },
      { titleId: "Y", trophyId: 3, type: "bronze", earnedAt: at(38, 1) },
    ];
    await insertTrophies(db, seeds);
    const order = seeds
      .map((s) => ({ earnedAtMs: s.earnedAt.getTime(), type: s.type, trophyId: s.trophyId, titleId: s.titleId }))
      .sort(compareEarnedOrder);
    const { items } = await log({ order: "asc" });
    expect(items.map((r) => [r.key, r.n])).toEqual(order.map((k, i) => [`${k.titleId}:${k.trophyId}`, i + 1]));
    expect(keys(items)).toEqual(["B:2", "A:1", "B:1", "A:5", "A:0", "Y:3", "x:3"]);
  });

  it("puts the platinum above the last trophy of its game", async () => {
    await insertTitle(db, { id: "M", name: "Magicka 2" });
    await insertTrophies(db, [
      { titleId: "M", trophyId: 3, name: "Apprentice", earnedAt: at(10) },
      { titleId: "M", trophyId: 5, type: "gold", name: "Archmage", earnedAt: at(37, 800) },
      { titleId: "M", trophyId: 0, type: "platinum", name: "You Are The Special", earnedAt: at(37, 200) },
    ]);
    const { items } = await log();
    expect(items.map((r) => [r.name, r.n])).toEqual([
      ["You Are The Special", 3],
      ["Archmage", 2],
      ["Apprentice", 1],
    ]);
  });

  it("keeps the number whatever the filters and the sort", async () => {
    await insertTitle(db, { id: "P4", platforms: ["PS4"] });
    await insertTitle(db, { id: "P5", platforms: ["PS5"] });
    await insertTrophies(db, [
      { titleId: "P4", trophyId: 1, type: "gold", name: "Zeta", earnedAt: at(1), earnedRate: 3 },
      { titleId: "P5", trophyId: 1, name: "alpha", earnedAt: at(2), earnedRate: 60 },
      { titleId: "P4", trophyId: 2, name: "Mu", earnedAt: at(3), earnedRate: 12 },
      { titleId: "P5", trophyId: 2, type: "gold", name: "Beta", earnedAt: at(4), earnedRate: 30 },
      { titleId: "P4", trophyId: 0, type: "platinum", name: "Omega", earnedAt: at(4), earnedRate: 1 },
    ]);
    const numbers = new Map((await log()).items.map((r) => [r.key, r.n]));
    expect([...numbers.values()].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
    const queries: Partial<LogQuery>[] = [
      { type: "gold" },
      { platform: "PS4" },
      { rarity: "common" },
      { sort: "alphabetical", order: "asc" },
      { sort: "rarity", order: "desc", platform: "PS5" },
      { order: "asc", type: "bronze" },
    ];
    for (const query of queries) {
      const { items } = await log(query);
      expect(items.length).toBeGreaterThan(0);
      for (const r of items) expect(r.n, `${r.key} under ${JSON.stringify(query)}`).toBe(numbers.get(r.key));
    }
    const { items: page } = await log({ sort: "alphabetical" }, { offset: 2, limit: 2 });
    for (const r of page) expect(r.n).toBe(numbers.get(r.key));
  });

  it("leaves out unearned trophies and hidden games", async () => {
    await insertTitle(db, { id: "A" });
    await insertTitle(db, { id: "H", hidden: true });
    await insertTrophies(db, [
      { titleId: "A", trophyId: 1, earnedAt: at(1) },
      { titleId: "A", trophyId: 2 },
      { titleId: "A", trophyId: 3 },
      { titleId: "H", trophyId: 1, earnedAt: at(0) },
      { titleId: "A", trophyId: 4, earnedAt: at(2) },
    ]);
    // Earned but undated.
    await db.update(trophies).set({ earned: true }).where(and(eq(trophies.titleId, "A"), eq(trophies.trophyId, 3)));
    const { items, total } = await log();
    expect(items.map((r) => [r.key, r.n])).toEqual([
      ["A:4", 2],
      ["A:1", 1],
    ]);
    expect(total).toBe(2);
  });

  it("filters by platform, rarity tier and type", async () => {
    await insertTitle(db, { id: "P4", platforms: ["PS3", "PS4"] });
    await insertTitle(db, { id: "P5", platforms: ["PS5"] });
    await insertTrophies(db, [
      { titleId: "P4", trophyId: 1, type: "gold", earnedAt: at(1), earnedRate: 5 },
      { titleId: "P5", trophyId: 1, type: "silver", earnedAt: at(2), earnedRate: 50 },
      { titleId: "P5", trophyId: 2, earnedAt: at(3), earnedRate: null },
      { titleId: "P5", trophyId: 3, earnedAt: at(4), earnedRate: 49.99 },
      { titleId: "P4", trophyId: 0, type: "platinum", earnedAt: at(5), earnedRate: 4.99 },
    ]);
    expect(await keysOf({ platform: "PS4" })).toEqual(["P4:0", "P4:1"]);
    expect(await keysOf({ platform: "PS5" })).toEqual(["P5:3", "P5:2", "P5:1"]);
    expect(await keysOf({ rarity: "ultra-rare" })).toEqual(["P4:0"]);
    expect(await keysOf({ rarity: "very-rare" })).toEqual(["P4:1"]);
    expect(await keysOf({ rarity: "rare" })).toEqual([]);
    expect(await keysOf({ rarity: "uncommon" })).toEqual(["P5:3"]);
    expect(await keysOf({ rarity: "common" })).toEqual(["P5:1"]);
    // The unknown rate is in none of the tiers above, only under All rarities.
    expect(await keysOf({})).toEqual(["P4:0", "P5:3", "P5:2", "P5:1", "P4:1"]);
    expect(await keysOf({ type: "bronze" })).toEqual(["P5:3", "P5:2"]);
    expect(await keysOf({ type: "platinum" })).toEqual(["P4:0"]);
    expect(await keysOf({ type: "gold", platform: "PS5" })).toEqual([]);
    expect(await keysOf({ platform: "PS5", rarity: "uncommon", type: "bronze" })).toEqual(["P5:3"]);
  });

  it("sorts by name ignoring case, newest first on a tie, in both orders", async () => {
    await insertTitle(db, { id: "A" });
    await insertTrophies(db, [
      { titleId: "A", trophyId: 1, name: "beta", earnedAt: at(1) },
      { titleId: "A", trophyId: 2, name: "Alpha", earnedAt: at(2) },
      { titleId: "A", trophyId: 3, name: "Gamma", earnedAt: at(3) },
      { titleId: "A", trophyId: 4, name: "alpha", earnedAt: at(4) },
    ]);
    const names = async (order: LogQuery["order"]) =>
      (await log({ sort: "alphabetical", order })).items.map((r) => r.name);
    expect(await names("asc")).toEqual(["alpha", "Alpha", "beta", "Gamma"]);
    expect(await names("desc")).toEqual(["Gamma", "beta", "alpha", "Alpha"]);
  });

  it("sorts by name ignoring accents and leading punctuation", async () => {
    await insertTitle(db, { id: "A" });
    const names = [" Journeyman", '"A hero"', "…There", "“Endless”", "À On", "Zebra", "apple"];
    await insertTrophies(
      db,
      names.map((name, i) => ({ titleId: "A", trophyId: i + 1, name, earnedAt: at(i + 1) })),
    );
    const got = async (order: LogQuery["order"]) =>
      (await log({ sort: "alphabetical", order })).items.map((r) => r.name);
    const asc = ['"A hero"', "À On", "apple", "“Endless”", " Journeyman", "…There", "Zebra"];
    expect(await got("asc")).toEqual(asc);
    expect(await got("desc")).toEqual([...asc].reverse());
  });

  it("sorts by rarity with unknown rates last in both orders, newest first on a tie", async () => {
    await insertTitle(db, { id: "A" });
    await insertTrophies(db, [
      { titleId: "A", trophyId: 1, earnedAt: at(1), earnedRate: 10.5 },
      { titleId: "A", trophyId: 2, earnedAt: at(2), earnedRate: null },
      { titleId: "A", trophyId: 3, earnedAt: at(3), earnedRate: 2 },
      { titleId: "A", trophyId: 4, earnedAt: at(4), earnedRate: 10.5 },
      { titleId: "A", trophyId: 5, earnedAt: at(5), earnedRate: 80 },
    ]);
    expect(await keysOf({ sort: "rarity", order: "asc" })).toEqual(["A:3", "A:4", "A:1", "A:5", "A:2"]);
    expect(await keysOf({ sort: "rarity", order: "desc" })).toEqual(["A:5", "A:4", "A:1", "A:3", "A:2"]);
  });

  it("pages without gaps or duplicates", async () => {
    await insertTitle(db, { id: "A" });
    await insertTitle(db, { id: "B" });
    await insertTrophies(db, [
      { titleId: "A", trophyId: 1, name: "Same", earnedAt: at(1), earnedRate: 7 },
      { titleId: "B", trophyId: 1, name: "same", earnedAt: at(1, 500), earnedRate: 7 },
      { titleId: "A", trophyId: 2, name: "Other", earnedAt: at(2), earnedRate: 30 },
      { titleId: "B", trophyId: 2, name: "Third", earnedAt: at(3), earnedRate: null },
      { titleId: "A", trophyId: 0, type: "platinum", name: "Last", earnedAt: at(3), earnedRate: 2 },
      { titleId: "B", trophyId: 3, name: "Fourth", earnedAt: at(4), earnedRate: 30 },
      { titleId: "A", trophyId: 3, name: "Fifth", earnedAt: at(5), earnedRate: null },
    ]);
    for (const sort of LOG_SORTS) {
      for (const order of LOG_ORDERS) {
        const all = keys((await log({ sort, order })).items);
        const paged: string[] = [];
        for (let offset = 0; offset < 9; offset += 3) {
          paged.push(...keys((await log({ sort, order }, { offset, limit: 3 })).items));
        }
        expect(all).toHaveLength(7);
        expect(new Set(all).size).toBe(7);
        expect(paged, `${sort} ${order}`).toEqual(all);
      }
    }
  });

  it("counts the matching rows and all logged trophies", async () => {
    expect(await log()).toEqual({ items: [], total: 0 });
    expect(await countLoggedTrophies(db)).toBe(0);

    await insertTitle(db, { id: "A" });
    await insertTitle(db, { id: "H", hidden: true });
    await insertTrophies(db, [
      { titleId: "A", trophyId: 1, earnedAt: at(1) },
      { titleId: "A", trophyId: 2, earnedAt: at(2) },
      { titleId: "A", trophyId: 3, type: "gold", earnedAt: at(3) },
      { titleId: "A", trophyId: 4 },
      { titleId: "H", trophyId: 1, earnedAt: at(1) },
    ]);
    expect(await countLoggedTrophies(db)).toBe(3);
    const page = await log({ type: "bronze" }, { offset: 0, limit: 1 });
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(2);
    expect(await log({ type: "bronze" }, { offset: 5, limit: 50 })).toEqual({ items: [], total: 2 });
    expect((await log()).total).toBe(3);
  });

  it("fills a row", async () => {
    await insertTitle(db, { id: "CP", name: "Cyberpunk 2077", platforms: ["PS5", "PS4"] });
    // The PS4 list of the same game borrows the PS5 list's icon, which is not square: not shown on a tile.
    await insertTitle(db, { id: "CP4", name: "Cyberpunk 2077", platforms: ["PS4"] });
    await insertGroup(db, { titleId: "CP", groupId: "default", name: "Cyberpunk 2077" });
    await insertGroup(db, { titleId: "CP", groupId: "001", name: "Phantom Liberty" });
    await db.insert(images).values([
      { url: "https://img.example/icon.png", localPath: "psn/game.png", thumbPath: "psn/game-thumb.png" },
      { url: "https://img.example/t7.png", localPath: "psn/t7.png", thumbPath: "psn/t7-thumb.png" },
    ]);
    await insertTrophies(db, [
      {
        titleId: "CP",
        trophyId: 7,
        groupId: "001",
        type: "gold",
        name: "The APB is Not Enough",
        detail: "Catch them all.",
        earnedAt: at(37, 400),
        earnedRate: 4.6,
        unobtainable: true,
      },
      { titleId: "CP", trophyId: 1, earnedAt: at(1), detail: null, earnedRate: null },
      { titleId: "CP4", trophyId: 2, earnedAt: at(2), earnedRate: 60 },
    ]);
    const { items } = await log();
    const [imageMap, siblings, rows] = await Promise.all([
      loadImageMap(db),
      loadSiblingIndex(db),
      db.select().from(titles),
    ]);
    const game = (id: string) => toGameRow(rows.find((t) => t.npCommunicationId === id)!, imageMap, siblings);
    expect(game("CP").coverSrc).toBe("/media/psn/game-thumb.png");
    expect(game("CP").coverIsIcon).toBe(true);
    expect(game("CP4").coverIsIcon).toBe(false);

    expect(items[0]).toEqual({
      key: "CP:7",
      n: 3,
      name: "The APB is Not Enough",
      detail: "Catch them all.",
      iconSrc: "/media/psn/t7-thumb.png",
      type: "gold",
      gameId: "CP",
      gameName: "Cyberpunk 2077",
      gameSrc: game("CP").coverSrc,
      gameIsIcon: game("CP").coverIsIcon,
      dlc: "Phantom Liberty",
      platforms: ["PS4", "PS5"],
      date: "5 Nov 2026",
      time: "00:16:37",
      ratePct: "4.60%",
      tier: "Ultra rare",
      unobtainable: true,
    } satisfies LogRow);
    expect(items[1]).toMatchObject({
      key: "CP4:2",
      gameSrc: game("CP4").coverSrc,
      gameIsIcon: false,
      platforms: ["PS4"],
      ratePct: "60.00%",
      tier: "Common",
    });
    expect(items[2]).toMatchObject({
      key: "CP:1",
      detail: "",
      iconSrc: "/icons/placeholder.svg",
      dlc: null,
      ratePct: null,
      tier: null,
      unobtainable: false,
    });
  });
});
