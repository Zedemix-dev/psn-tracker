import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/src/db/client";
import { titles } from "@/src/db/schema";
import { parseGameQuery, queryGames, type GameQuery } from "@/src/games/query";
import { insertTrophies } from "@/tests/fixtures/profile";
import { createTestDb } from "@/tests/helpers/db";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

type Seed = Partial<typeof titles.$inferInsert> & { id: string };
async function addTitle({ id, ...over }: Seed) {
  await db.insert(titles).values({
    npCommunicationId: id,
    npServiceName: "trophy",
    name: `Game ${id}`,
    iconUrl: "https://img.example/icon.png",
    platforms: ["PS5"],
    trophySetVersion: "1.00",
    ...over,
  });
}

const base: GameQuery = { state: "all", platform: "all", sort: "alphabetical", q: "", offset: 0 };
const ids = async (q: Partial<GameQuery>, hideZero = false) =>
  (await queryGames(db, { ...base, ...q }, { hideZero })).items.map((i) => i.id);

describe("parseGameQuery", () => {
  it("falls back to defaults on invalid values", () => {
    const q = parseGameQuery(
      new URLSearchParams("state=bogus&platform=PS3&sort=nope&offset=-5&q=%20zelda%20"),
    );
    expect(q).toEqual({ state: "all", platform: "all", sort: "lastPlayed", q: "zelda", offset: 0 });
  });

  it("reads valid values", () => {
    const q = parseGameQuery(new URLSearchParams("state=notFinished&platform=PS4&sort=percent&offset=50"));
    expect(q).toEqual({ state: "notFinished", platform: "PS4", sort: "percent", q: "", offset: 50 });
  });
});

describe("filters", () => {
  beforeEach(async () => {
    await addTitle({ id: "plat93", name: "Plat 93", progress: 93, definedPlatinum: 1, earnedPlatinum: 1 });
    await addTitle({ id: "noplat93", name: "NoPlat 93", progress: 93 });
    await addTitle({ id: "full", name: "Full", progress: 100, definedPlatinum: 1, earnedPlatinum: 1 });
    await addTitle({ id: "zero", name: "Zero", progress: 0 });
    await addTitle({ id: "hid", name: "Hidden", progress: 50, hidden: true });
  });

  it("notFinished excludes a platinum-earned 93% game and includes a non-platinum 93% game", async () => {
    const r = await ids({ state: "notFinished" });
    expect(r).not.toContain("plat93");
    expect(r).toContain("noplat93");
  });

  it("applies 100, not100, platinum and platinumNot100", async () => {
    expect(await ids({ state: "100" })).toEqual(["full"]);
    expect(await ids({ state: "not100" })).toEqual(["noplat93", "plat93", "zero"]);
    expect(await ids({ state: "platinum" })).toEqual(["full", "plat93"]);
    expect(await ids({ state: "platinumNot100" })).toEqual(["plat93"]);
  });

  it("always excludes hidden titles and drops 0% ones with hideZero", async () => {
    expect(await ids({})).not.toContain("hid");
    expect(await ids({})).toContain("zero");
    expect(await ids({}, true)).not.toContain("zero");
    const { total } = await queryGames(db, base, { hideZero: true });
    expect(total).toBe(3);
  });
});

describe("platform filter", () => {
  it("matches titles whose platforms contain the value", async () => {
    await addTitle({ id: "a", platforms: ["PS4"] });
    await addTitle({ id: "b", platforms: ["PS4", "PS5"] });
    await addTitle({ id: "c", platforms: ["PS5"] });
    await addTitle({ id: "d", platforms: ["PSVITA"] });
    expect(await ids({ platform: "PS4" })).toEqual(["a", "b"]);
    expect(await ids({ platform: "PS5" })).toEqual(["b", "c"]);
    expect(await ids({ platform: "all" })).toHaveLength(4);
  });
});

describe("search", () => {
  beforeEach(async () => {
    await addTitle({ id: "a", name: "Zelda Breath" });
    await addTitle({ id: "b", name: "50% Off Fun" });
    await addTitle({ id: "c", name: "Under_score" });
    await addTitle({ id: "d", name: "UnderXscore" });
  });

  it("is a case-insensitive substring match", async () => {
    expect(await ids({ q: "bREATH" })).toEqual(["a"]);
  });

  it("escapes LIKE wildcards", async () => {
    expect(await ids({ q: "50%" })).toEqual(["b"]);
    expect(await ids({ q: "%" })).toEqual(["b"]);
    expect(await ids({ q: "r_s" })).toEqual(["c"]);
    expect(await ids({ q: "\\" })).toEqual([]);
  });

  it("treats an empty query as no filter", async () => {
    expect(await ids({ q: "" })).toHaveLength(4);
  });
});

describe("sorts", () => {
  it("platinumRarity puts 1.30 before 50.82 and titles without platinum last", async () => {
    await addTitle({ id: "common", name: "Common", definedPlatinum: 1 });
    await addTitle({ id: "rare", name: "Rare", definedPlatinum: 1 });
    await addTitle({ id: "none", name: "Aaa none" });
    await addTitle({ id: "nullrate", name: "Null rate", definedPlatinum: 1 });
    await insertTrophies(db, [
      { titleId: "common", trophyId: 1, type: "platinum", earnedRate: 50.82 },
      { titleId: "common", trophyId: 2, type: "bronze", earnedRate: 0.5 },
      { titleId: "rare", trophyId: 1, type: "platinum", earnedRate: 1.3 },
      { titleId: "nullrate", trophyId: 1, type: "platinum", earnedRate: null },
    ]);
    expect(await ids({ sort: "platinumRarity" })).toEqual(["rare", "common", "none", "nullrate"]);
  });

  it("lastPlayed uses coalesce(lastPlayedAt, lastTrophyAt), nulls last, name tie-break", async () => {
    await addTitle({ id: "a", name: "B", lastPlayedAt: new Date("2024-01-05Z") });
    await addTitle({ id: "b", name: "A", lastTrophyAt: new Date("2024-01-06Z") });
    await addTitle({ id: "c", name: "C", lastPlayedAt: new Date("2024-01-04Z"), lastTrophyAt: new Date("2024-01-09Z") });
    await addTitle({ id: "d", name: "D" });
    await addTitle({ id: "e", name: "A2", lastPlayedAt: new Date("2024-01-05Z") });
    expect(await ids({ sort: "lastPlayed" })).toEqual(["b", "e", "a", "c", "d"]);
  });

  it("alphabetical is case-insensitive", async () => {
    await addTitle({ id: "1", name: "banana" });
    await addTitle({ id: "2", name: "Apple" });
    await addTitle({ id: "3", name: "cherry" });
    expect(await ids({ sort: "alphabetical" })).toEqual(["2", "1", "3"]);
  });

  it("orders by trophy counts, percent and time played, descending", async () => {
    await addTitle({ id: "x", name: "X", definedBronze: 10, earnedBronze: 10, progress: 100, playSeconds: 10 });
    await addTitle({ id: "y", name: "Y", definedGold: 30, earnedGold: 1, progress: 3, playSeconds: 999 });
    await addTitle({ id: "z", name: "Z", definedSilver: 5, earnedSilver: 2, progress: 40 });
    expect(await ids({ sort: "totalTrophies" })).toEqual(["y", "x", "z"]);
    expect(await ids({ sort: "earnedTrophies" })).toEqual(["x", "z", "y"]);
    expect(await ids({ sort: "unearnedTrophies" })).toEqual(["y", "z", "x"]);
    expect(await ids({ sort: "percent" })).toEqual(["x", "z", "y"]);
    expect(await ids({ sort: "timePlayed" })).toEqual(["y", "x", "z"]);
  });

  it("lastTrophy sorts descending with nulls last", async () => {
    await addTitle({ id: "a", lastTrophyAt: new Date("2024-01-01Z") });
    await addTitle({ id: "b", lastTrophyAt: new Date("2024-02-01Z") });
    await addTitle({ id: "c" });
    expect(await ids({ sort: "lastTrophy" })).toEqual(["b", "a", "c"]);
  });
});

describe("pagination", () => {
  it("returns the remaining 20 at offset 100 of 120, with total 120", async () => {
    await db.insert(titles).values(
      Array.from({ length: 120 }, (_, i) => ({
        npCommunicationId: `T${String(i).padStart(3, "0")}`,
        npServiceName: "trophy",
        name: `Game ${String(i).padStart(3, "0")}`,
        iconUrl: "https://img.example/icon.png",
        platforms: ["PS5"],
        trophySetVersion: "1.00",
      })),
    );
    const page = await queryGames(db, { ...base, offset: 100 }, { hideZero: false });
    expect(page.items).toHaveLength(20);
    expect(page.total).toBe(120);
    expect((await queryGames(db, base, { hideZero: false })).items).toHaveLength(50);
    expect((await queryGames(db, { ...base, offset: -10 }, { hideZero: false })).items[0].id).toBe("T000");
  });
});
