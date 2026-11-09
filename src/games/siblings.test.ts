import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/src/db/client";
import { titles } from "@/src/db/schema";
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
