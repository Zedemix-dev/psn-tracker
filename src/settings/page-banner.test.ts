import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/src/db/client";
import { images, titles } from "@/src/db/schema";
import { getPageBanner } from "@/src/settings/page-banner";
import { setBanner } from "@/src/settings/repo";
import { createTestDb } from "@/tests/helpers/db";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

async function addGame(id: string, over: Partial<typeof titles.$inferInsert> = {}, downloaded = true) {
  const bannerUrl = `https://img.example/${id}.jpg`;
  await db.insert(titles).values({
    npCommunicationId: id,
    npServiceName: "trophy",
    name: `Game ${id}`,
    iconUrl: "https://img.example/icon.png",
    platforms: ["PS5"],
    trophySetVersion: "1.00",
    bannerUrl,
    ...over,
  });
  await db.insert(images).values({ url: bannerUrl, localPath: downloaded ? `banners/${id}.jpg` : null });
}

describe("getPageBanner", () => {
  it("prefers the custom banner, with its position", async () => {
    await addGame("A", { lastPlayedAt: new Date("2026-11-01T00:00:00Z") });
    await setBanner(db, "custom.jpg", 30);
    expect(await getPageBanner(db)).toEqual({ path: "custom.jpg", posY: 30, source: "custom", gameName: null });
  });

  it("falls back to the most recently played game with a downloaded banner", async () => {
    await addGame("A", { lastPlayedAt: new Date("2026-11-01T00:00:00Z") });
    await addGame("B", { lastPlayedAt: new Date("2026-11-05T00:00:00Z") });
    await addGame("C", { lastPlayedAt: null });
    expect(await getPageBanner(db)).toEqual({ path: "banners/B.jpg", posY: 25, source: "auto", gameName: "Game B" });
  });

  it("skips hidden games and banners not downloaded yet", async () => {
    await addGame("A", { lastPlayedAt: new Date("2026-11-01T00:00:00Z") });
    await addGame("B", { lastPlayedAt: new Date("2026-11-05T00:00:00Z"), hidden: true });
    await addGame("C", { lastPlayedAt: new Date("2026-11-06T00:00:00Z") }, false);
    expect((await getPageBanner(db))?.gameName).toBe("Game A");
  });

  it("returns null without any candidate", async () => {
    await addGame("A", { lastPlayedAt: new Date("2026-11-01T00:00:00Z"), hidden: true });
    expect(await getPageBanner(db)).toBeNull();
  });
});
