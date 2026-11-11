import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/src/db/client";
import { titles, trophies, trophyGroups } from "@/src/db/schema";
import { getGameDetail } from "@/src/games/detail";
import type { ImageMap } from "@/src/sync/images";
import { createTestDb } from "@/tests/helpers/db";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

const NOW = new Date("2026-11-08T12:00:00Z");
const empty: ImageMap = new Map();

async function addTitle(over: Partial<typeof titles.$inferInsert> = {}) {
  await db.insert(titles).values({
    npCommunicationId: "NPWR1",
    npServiceName: "trophy",
    name: "Cyber Game",
    iconUrl: "https://img.example/icon.png",
    platforms: ["PS5", "PS4"],
    trophySetVersion: "1.00",
    ...over,
  });
}

type T = typeof trophies.$inferInsert;
async function addTrophy(trophyId: number, over: Partial<T> = {}) {
  await db.insert(trophies).values({
    titleId: "NPWR1",
    trophyId,
    type: "bronze",
    name: `T${trophyId}`,
    iconUrl: `https://img.example/t${trophyId}.png`,
    ...over,
  });
}

describe("getGameDetail borrowing", () => {
  it("borrows banner and publisher from the PS5 version, and has none when nobody has one", async () => {
    await addTitle({ npCommunicationId: "P4", platforms: ["PS4"] });
    await addTitle({
      npCommunicationId: "P5",
      platforms: ["PS5"],
      bannerUrl: "https://img.example/banner.png",
      publisher: "Studio",
    });
    const map: ImageMap = new Map([["https://img.example/banner.png", { path: "psn/b.png", thumb: null, tileBg: null }]]);
    const d = await getGameDetail(db, "P4", map, NOW);
    expect(d!.bannerPath).toBe("psn/b.png");
    expect(d!.publisher).toBe("Studio");
    await db.update(titles).set({ bannerUrl: null }).where(eq(titles.npCommunicationId, "P5"));
    expect((await getGameDetail(db, "P4", map, NOW))!.bannerPath).toBeNull();
  });
});

describe("getGameDetail hand-picked banner", () => {
  const URL_ = "https://img.psnprofiles.com/hero/l/14795/05bf48f1-d893-41d8-b1f7-1ea0bfcc3bc0.jpg";
  const map: ImageMap = new Map([[URL_, { path: "psn/dauntless.jpg", thumb: null, tileBg: null }]]);

  it("uses the downloaded override when no version has a banner, without logo", async () => {
    await addTitle({ name: "Dauntless" });
    const d = await getGameDetail(db, "NPWR1", map, NOW);
    expect(d!.bannerPath).toBe("psn/dauntless.jpg");
    expect(d!.logoSrc).toBeNull();
    expect(d!.bannerIsOverride).toBe(true);
  });

  it("has no banner while the override is not downloaded", async () => {
    await addTitle({ name: "Dauntless" });
    expect((await getGameDetail(db, "NPWR1", empty, NOW))!.bannerPath).toBeNull();
  });

  it("keeps its own banner over the override", async () => {
    const own = "https://img.example/own.png";
    await addTitle({ name: "Dauntless", bannerUrl: own });
    const both: ImageMap = new Map([...map, [own, { path: "psn/own.png", thumb: null, tileBg: null }]]);
    const d = await getGameDetail(db, "NPWR1", both, NOW);
    expect(d!.bannerPath).toBe("psn/own.png");
    expect(d!.bannerIsOverride).toBe(false);
  });
});

describe("getGameDetail", () => {
  it("builds the Cyberpunk-like detail", async () => {
    await addTitle({ progress: 7 });
    await db.insert(trophyGroups).values([
      { titleId: "NPWR1", groupId: "default", name: "", definedPlatinum: 1 },
      { titleId: "NPWR1", groupId: "001", name: "Phantom Liberty", definedBronze: 13 },
    ]);
    await addTrophy(0, { type: "platinum", earned: true, earnedAt: new Date("2026-11-01T10:00:00Z") });
    for (let i = 1; i <= 13; i++) {
      await addTrophy(i, { groupId: "001", earned: i <= 2, earnedAt: i <= 2 ? new Date("2026-11-02T10:00:00Z") : null });
    }
    const d = await getGameDetail(db, "NPWR1", empty, NOW);
    expect(d).not.toBeNull();
    expect(d!.groups.map((g) => g.kicker)).toEqual(["Base game", "DLC 1"]);
    expect(d!.groups[0].name).toBe("Cyber Game");
    expect(d!.groups[1].name).toBe("Phantom Liberty");
    expect(d!.groups[1].progress).toBe(15);
    expect(d!.groups[0].status).toBe("plat-earned");
    expect(d!.groups[1].status).toBe("incomplete");
    expect(d!.progress).toBe(7);
    expect(d!.platforms).toEqual(["PS4", "PS5"]);
    expect(d!.trophies).toHaveLength(14);
    expect(d!.trophies[0].id).toBe(0);
  });

  it("shows a counter only for an unearned trophy with a known target and progress", async () => {
    await addTitle();
    await addTrophy(1, { progressTarget: 5000, progress: 3626 });
    await addTrophy(2, { progressTarget: 5000, progress: 5000, earned: true, earnedAt: NOW });
    await addTrophy(3, { progressTarget: 5000, progress: null });
    await addTrophy(4, { progressTarget: 4, progress: 0 });
    const d = await getGameDetail(db, "NPWR1", empty, NOW);
    const by = (id: number) => d!.trophies.find((t) => t.id === id)!;
    expect(by(1).counter).toBe("3,626/5,000");
    expect(by(2).counter).toBeNull();
    expect(by(3).counter).toBeNull();
    expect(by(4).counter).toBe("0/4");
  });

  it("falls back cleanly without concept, catalog or downloaded images", async () => {
    await addTitle();
    const d = await getGameDetail(db, "NPWR1", empty, NOW);
    expect(d!.bannerPath).toBeNull();
    expect(d!.logoSrc).toBeNull();
    expect(d!.publisher).toBeNull();
    expect(d!.genres).toBeNull();
    expect(d!.releaseDate).toBeNull();
    expect(d!.rarity).toBeNull();
    expect(d!.coverIsIcon).toBe(true);
  });

  it("returns null for an unknown id", async () => {
    expect(await getGameDetail(db, "nope", empty, NOW)).toBeNull();
  });
});

describe("getGameDetail group images", () => {
  const cover = "https://img.example/cover.png";
  const map: ImageMap = new Map([
    [cover, { path: "psn/cover.png", thumb: null, tileBg: null }],
    ["https://img.example/icon.png", { path: "psn/icon.png", thumb: null, tileBg: null }],
    ["https://img.example/dlc.png", { path: "psn/dlc.png", thumb: null, tileBg: null }],
  ]);
  async function addGroups() {
    await db.insert(trophyGroups).values({ titleId: "NPWR1", groupId: "default", name: "Base" });
    await db
      .insert(trophyGroups)
      .values({ titleId: "NPWR1", groupId: "001", name: "DLC", iconUrl: "https://img.example/dlc.png" });
    await addTrophy(1, { groupId: "default" });
    await addTrophy(2, { groupId: "001" });
  }

  it("shows the square cover on every group of a PS4 list", async () => {
    await addTitle({ platforms: ["PS4"], coverUrl: cover });
    await addGroups();
    const d = await getGameDetail(db, "NPWR1", map, NOW);
    expect(d!.groups).toHaveLength(2);
    for (const g of d!.groups) {
      expect(g.iconSrc).toBe(d!.coverSrc);
      expect(g.iconIsCover).toBe(true);
    }
  });

  it("shows the list icon, contained, on every group of a PS4 list without a cover", async () => {
    await addTitle({ platforms: ["PS4"] });
    await addGroups();
    const d = await getGameDetail(db, "NPWR1", map, NOW);
    expect(d!.coverIsIcon).toBe(true);
    expect(d!.groups).toHaveLength(2);
    for (const g of d!.groups) {
      expect(g.iconSrc).toBe(d!.coverSrc);
      expect(g.iconIsCover).toBe(false);
    }
  });

  it("keeps each group's own icon on a PS5 list", async () => {
    await addTitle({ platforms: ["PS5"], coverUrl: cover });
    await addGroups();
    const d = await getGameDetail(db, "NPWR1", map, NOW);
    expect(d!.groups.map((g) => g.iconSrc)).toEqual([
      expect.stringContaining("icon.png"),
      expect.stringContaining("dlc.png"),
    ]);
    expect(d!.groups.every((g) => !g.iconIsCover)).toBe(true);
  });
});

describe("getGameDetail unobtainable", () => {
  it("builds the band and marks the trophies", async () => {
    await addTitle({
      unobtainableCount: 3,
      unobtainableNote: "Closed.",
      definedBronze: 4,
    });
    await addTrophy(0, { unobtainable: true, earned: true, earnedAt: NOW });
    await addTrophy(1, { unobtainable: true });
    await addTrophy(2, { unobtainable: true });
    await addTrophy(3);
    const d = await getGameDetail(db, "NPWR1", empty, NOW);
    expect(d!.unobtainable).toEqual({
      label: "3 unobtainable trophies",
      situation: ", 2 you don't have",
      note: [{ text: "Closed." }],
    });
    expect(d!.trophies[0].unobtainable).toBe(true);
    expect(d!.trophies[3].unobtainable).toBe(false);
  });

  it("has no band for an unmarked game", async () => {
    await addTitle();
    await addTrophy(0);
    const d = await getGameDetail(db, "NPWR1", empty, NOW);
    expect(d!.unobtainable).toBeNull();
    expect(d!.trophies[0].unobtainable).toBe(false);
  });
});

