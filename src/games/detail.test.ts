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
    const map: ImageMap = new Map([["https://img.example/banner.png", { path: "psn/b.png", thumb: null }]]);
    const d = await getGameDetail(db, "P4", map, NOW);
    expect(d!.bannerPath).toBe("psn/b.png");
    expect(d!.publisher).toBe("Studio");
    await db.update(titles).set({ bannerUrl: null }).where(eq(titles.npCommunicationId, "P5"));
    expect((await getGameDetail(db, "P4", map, NOW))!.bannerPath).toBeNull();
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
