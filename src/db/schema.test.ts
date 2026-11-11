import { describe, expect, it } from "vitest";
import { createTestDb } from "@/tests/helpers/db";
import { images, profile, settings, titles, trophies, unobtainableList } from "@/src/db/schema";

describe("schema", () => {
  it("applies migrations and seeds the singleton rows", async () => {
    const db = await createTestDb();
    const rows = await db.select().from(settings);
    expect(rows).toHaveLength(1);
    expect(rows[0].hideZero).toBe(false);
    expect(rows[0].psnAuthStatus).toBe("missing");
    expect(await db.select().from(profile)).toHaveLength(1);
  });

  it("stores tiered trophy progress and game catalog columns", async () => {
    const db = await createTestDb();
    await db.insert(titles).values({
      npCommunicationId: "NPWR00001_00",
      npServiceName: "trophy2",
      name: "Test Game",
      iconUrl: "https://example.com/icon.png",
      platforms: ["PS5"],
      trophySetVersion: "01.00",
      conceptId: 234567,
      genres: ["Role Playing Games"],
      releaseDate: new Date("2020-12-10T00:00:00Z"),
    });
    const progressedAt = new Date("2026-01-02T03:04:05Z");
    await db.insert(trophies).values({
      titleId: "NPWR00001_00",
      trophyId: 1,
      type: "gold",
      name: "Grind",
      iconUrl: "https://example.com/t.png",
      progressTarget: 5000,
      progress: 3626,
      progressedAt,
    });
    const [t] = await db.select().from(titles);
    expect(t.conceptId).toBe(234567);
    expect(t.genres).toEqual(["Role Playing Games"]);
    expect(t.releaseDate?.toISOString()).toBe("2020-12-10T00:00:00.000Z");
    expect(t.publisher).toBeNull();
    const [tr] = await db.select().from(trophies);
    expect(tr.progressTarget).toBe(5000);
    expect(typeof tr.progressTarget).toBe("number");
    expect(tr.progress).toBe(3626);
    expect(tr.progressedAt?.getTime()).toBe(progressedAt.getTime());
  });

  it("defaults the unobtainable columns", async () => {
    const db = await createTestDb();
    await db.insert(titles).values({
      npCommunicationId: "NPWR00001_00",
      npServiceName: "trophy2",
      name: "Test Game",
      iconUrl: "https://example.com/icon.png",
      platforms: ["PS5"],
      trophySetVersion: "01.00",
    });
    await db.insert(trophies).values({
      titleId: "NPWR00001_00",
      trophyId: 1,
      type: "gold",
      name: "Grind",
      iconUrl: "https://example.com/t.png",
    });
    const [s] = await db.select().from(settings);
    const [title] = await db.select().from(titles);
    const [trophy] = await db.select().from(trophies);
    expect(s.unobtainableListUrl).toBe("https://psnp-plus.huskycode.dev/list.json");
    expect(s.unobtainableRequestedAt).toBeNull();
    expect(title.unobtainableCount).toBe(0);
    expect(title.unobtainableNote).toBeNull();
    expect(trophy.unobtainable).toBe(false);
    expect(await db.select().from(unobtainableList)).toEqual([]);
  });

  it("adds the phase 1 follow-up columns with their defaults", async () => {
    const db = await createTestDb();
    const [s] = await db.select().from(settings);
    expect(s.psnLanguage).toBeNull();
    expect(s.syncRequestFailures).toBe(0);
    await db.insert(images).values({ url: "https://example.com/a.png" });
    const [img] = await db.select().from(images);
    expect(img.tileBg).toBeNull();
    expect(img.tileCheckedAt).toBeNull();
  });
});
