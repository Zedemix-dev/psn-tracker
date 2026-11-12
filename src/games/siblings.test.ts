import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getGameDetail } from "@/src/games/detail";
import { parseGameQuery, queryGames } from "@/src/games/query";
import { getStatsData } from "@/src/stats/load";
import { advisorScope, getIncompleteGames, queryAdvisor } from "@/src/trophy-advisor/load";
import { DEFAULT_ADVISOR_QUERY } from "@/src/trophy-advisor/query";
import { queryTrophyLog } from "@/src/trophy-log/load";
import { DEFAULT_LOG_QUERY } from "@/src/trophy-log/query";
import type { Db } from "@/src/db/client";
import { syncRuns, titles, trophies } from "@/src/db/schema";
import { gameKey, loadSiblingIndex, withSiblings } from "@/src/games/siblings";
import { createTestDb } from "@/tests/helpers/db";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

async function add(id: string, name: string, platforms: string[], over: Partial<typeof titles.$inferInsert> = {}) {
  await db.insert(titles).values({
    npCommunicationId: id,
    npServiceName: "trophy",
    name,
    iconUrl: `https://img/${id}-icon.png`,
    platforms,
    trophySetVersion: "1.00",
    ...over,
  });
}

async function resolve(id: string) {
  const index = await loadSiblingIndex(db);
  const all = [...index.values()].flat();
  const t = all.find((x) => x.npCommunicationId === id)!;
  return withSiblings(t, index);
}

describe("gameKey", () => {
  it("ignores case, trademark signs and extra spaces", () => {
    expect(gameKey("ELDEN RING™")).toBe(gameKey("Elden  Ring"));
  });
});

describe("withSiblings", () => {
  it("borrows every missing value from the PS5 version", async () => {
    await add("A4", "Gran Turismo 7", ["PS4"]);
    const d = new Date("2022-03-04T00:00:00Z");
    await add("A5", "Gran Turismo 7", ["PS5"], {
      coverUrl: "https://img/cover.png",
      bannerUrl: "https://img/banner.png",
      logoUrl: "https://img/logo.png",
      publisher: "Sony",
      genres: ["Racing"],
      releaseDate: d,
    });
    const info = await resolve("A4");
    expect(info).toMatchObject({
      coverUrl: "https://img/cover.png",
      bannerUrl: "https://img/banner.png",
      logoUrl: "https://img/logo.png",
      publisher: "Sony",
      genres: ["Racing"],
      coverIsIcon: false,
    });
    expect(info.releaseDate).toEqual(d);
  });

  it("keeps its own banner over another version's", async () => {
    await add("A4", "Game", ["PS4"], { bannerUrl: "https://img/own.png" });
    await add("A5", "Game", ["PS5"], { bannerUrl: "https://img/other.png" });
    expect((await resolve("A4")).bannerUrl).toBe("https://img/own.png");
  });

  it("gives a PS4 title the PS5 icon as cover, and keeps the PS5 icon for the PS5", async () => {
    await add("D4", "Dauntless", ["PS4"]);
    await add("D5", "Dauntless", ["PS5"]);
    const ps4 = await resolve("D4");
    expect(ps4.coverUrl).toBeNull();
    expect(ps4.coverFallbackUrl).toBe("https://img/D5-icon.png");
    expect(ps4.coverIsIcon).toBe(false);
    const ps5 = await resolve("D5");
    expect(ps5.coverFallbackUrl).toBe("https://img/D5-icon.png");
    expect(ps5.coverIsIcon).toBe(true);
  });

  it("without a PS5 version, the most recently played one lends", async () => {
    await add("X1", "Game", ["PS4"]);
    await add("X2", "Game", ["PS4"], { publisher: "Old", lastPlayedAt: new Date("2020-01-01") });
    await add("X3", "Game", ["PS4"], { publisher: "Recent", lastPlayedAt: new Date("2024-01-01") });
    expect((await resolve("X1")).publisher).toBe("Recent");
  });

  it("treats empty genres as absent", async () => {
    await add("G4", "Game", ["PS4"], { genres: [] });
    await add("G5", "Game", ["PS5"], { genres: ["RPG"] });
    expect((await resolve("G4")).genres).toEqual(["RPG"]);
  });

  it("does not borrow from a hidden title", async () => {
    await add("H4", "Game", ["PS4"]);
    await add("H5", "Game", ["PS5"], { hidden: true, publisher: "Hidden" });
    expect((await resolve("H4")).publisher).toBeNull();
  });
});

describe("loadSiblingIndex cache", () => {
  it("is reused until a run ends", async () => {
    await add("A", "Same Game", ["PS5"]);
    const first = await loadSiblingIndex(db);
    expect(await loadSiblingIndex(db)).toBe(first);
    const [run] = await db.insert(syncRuns).values({ kind: "daily", status: "running" }).returning();
    await db.update(syncRuns).set({ status: "success", finishedAt: new Date("2026-11-12T10:00:00Z") }).where(eq(syncRuns.id, run.id));
    await add("B", "Other Game", ["PS5"]);
    const second = await loadSiblingIndex(db);
    expect(second).not.toBe(first);
    expect(second.size).toBe(2);
  });

  it("is not changed by the callers", async () => {
    await add("A", "Same Game", ["PS5"], { lastPlayedAt: new Date("2026-11-01T00:00:00Z"), publisher: "Pub" });
    await add("B", "Same Game", ["PS4"], { coverUrl: "https://img/b-cover.png" });
    await add("C", "Zed", ["PS5"]);
    await db.insert(trophies).values(
      ["A", "B", "C"].map((titleId) => ({
        titleId,
        trophyId: 1,
        groupId: "default",
        type: "bronze" as const,
        name: "T",
        detail: "d",
        iconUrl: "https://img/t.png",
        earned: titleId !== "C",
        earnedAt: titleId !== "C" ? new Date("2026-10-01T10:00:00Z") : null,
      })),
    );
    const index = await loadSiblingIndex(db);
    const before = structuredClone(index);
    const paging = { offset: 0, limit: 100 };
    const scope = advisorScope({ hideZero: false, advisorHideUnobtainable: false, advisorDlc: "all" });

    await queryGames(db, parseGameQuery(new URLSearchParams()), { hideZero: false });
    await getGameDetail(db, "B", new Map(), new Date("2026-11-12T10:00:00Z"));
    await queryTrophyLog(db, DEFAULT_LOG_QUERY, paging);
    await queryAdvisor(db, DEFAULT_ADVISOR_QUERY, scope, paging);
    await getIncompleteGames(db, scope);
    await getStatsData(db, { hideZero: false, now: new Date("2026-11-12T10:00:00Z") });

    expect(await loadSiblingIndex(db)).toBe(index);
    expect(index).toEqual(before);
  });
});
