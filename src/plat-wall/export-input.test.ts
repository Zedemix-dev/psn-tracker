import path from "node:path";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/src/db/client";
import { images, profile } from "@/src/db/schema";
import { loadExportInput } from "@/src/plat-wall/export-input";
import type { PlatQuery } from "@/src/plat-wall/query";
import { insertTitle, insertTrophies } from "@/tests/fixtures/profile";
import { createTestDb } from "@/tests/helpers/db";

const MEDIA = path.resolve("media-root");
const ALL: PlatQuery = { year: null, platform: "all", sort: "newest", show: ["art"] };
let db: Db;

beforeEach(async () => {
  db = await createTestDb();
  await db.update(profile).set({ onlineId: "Zmx969", avatarUrl: "https://img.example/av.png", level: 12, levelProgress: 40, tier: 2, earnedPlatinum: 3 }).where(eq(profile.id, 1));
  await insertTitle(db, { id: "A", name: "Alpha", platforms: ["PS4"] });
  await insertTitle(db, { id: "B", name: "Beta", platforms: ["PS5"] });
  await insertTrophies(db, [
    { titleId: "A", trophyId: 0, type: "platinum", earnedAt: new Date("2025-03-01T12:00:00Z"), earnedRate: 10 },
    { titleId: "B", trophyId: 7, type: "platinum", earnedAt: new Date("2026-03-01T12:00:00Z"), earnedRate: 5 },
  ]);
});

describe("loadExportInput", () => {
  it("returns null when nothing matches", async () => {
    expect(await loadExportInput(db, { ...ALL, year: 2019 }, MEDIA)).toBeNull();
  });

  it("keeps the filter and the sort", async () => {
    const out = await loadExportInput(db, { ...ALL, platform: "PS5", show: ["art", "name"] }, MEDIA);
    expect(out?.input.tiles.map((t) => t.game)).toEqual(["Beta"]);
    expect(out?.input.show).toEqual(["art", "name"]);
    expect(out?.fileName).toBe("Zmx969-plat-wall-PS5.png");
    const sorted = await loadExportInput(db, { ...ALL, sort: "alphabetical" }, MEDIA);
    expect(sorted?.input.tiles.map((t) => t.game)).toEqual(["Alpha", "Beta"]);
  });

  it("turns thumbnails into files under mediaDir, null when not downloaded", async () => {
    await db.insert(images).values([
      { url: "https://img.example/t0.png", localPath: "psn/a.png", thumbPath: "psn/a.thumb.webp" },
      { url: "https://img.example/t7.png", localPath: "psn/b.png", thumbPath: null },
    ]);
    const out = await loadExportInput(db, { ...ALL, sort: "alphabetical" }, MEDIA);
    expect(out?.input.tiles.map((t) => t.file)).toEqual([
      path.join(MEDIA, "psn/a.thumb.webp"),
      path.join(MEDIA, "psn/b.png"),
    ]);
    expect(out?.input.profile.avatarFile).toBeNull();
    expect(out?.input.profile).toMatchObject({ onlineId: "Zmx969", level: 12, platinum: 3 });
  });

  it("keeps the profile stats unfiltered", async () => {
    const all = await loadExportInput(db, ALL, MEDIA);
    const some = await loadExportInput(db, { ...ALL, year: 2026 }, MEDIA);
    expect(some?.input.tiles).toHaveLength(1);
    expect(some?.input.stats).toEqual(all?.input.stats);
    expect(some?.input.stats.totalGames).toBe(2);
  });
});
