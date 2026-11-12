import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/src/db/client";
import { images, titles } from "@/src/db/schema";
import { upsertTitleRow } from "@/src/sync/title";
import { readFileSync } from "node:fs";
import { cacheImages } from "@/src/sync/image-cache";
import {
  imageHash,
  loadImageMap,
  mediaSrc,
  resolveMediaPath,
} from "@/src/sync/images";
import { makeRemoteTitle } from "@/tests/fixtures/titles";
import { createTestDb } from "@/tests/helpers/db";

const ICON = "https://image.api.playstation.com/icon1.png";
const COVER = "https://image.api.playstation.com/cover1.jpg?x=1";

let db: Db;
let dir: string;
beforeEach(async () => {
  db = await createTestDb();
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "media-"));
  await upsertTitleRow(db, makeRemoteTitle({ npCommunicationId: "NPWR00001_00" }));
  await db
    .update(titles)
    .set({ iconUrl: ICON, coverUrl: COVER })
    .where(eq(titles.npCommunicationId, "NPWR00001_00"));
});
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

const okFetch = () =>
  vi.fn(async (_url: string | URL | Request) => new Response(new Uint8Array([1, 2, 3]), { status: 200 }));

describe("loadImageMap / mediaSrc", () => {
  it("maps only cached images", async () => {
    await cacheImages(db, dir, okFetch());
    await db.insert(images).values({ url: "https://x/pending.png" });
    const map = await loadImageMap(db);
    expect(map.get(ICON)).toEqual({ path: `psn/${imageHash(ICON)}.png`, thumb: null, tileBg: null });
    expect(map.has("https://x/pending.png")).toBe(false);
  });

  it("exposes the stored tile colour", async () => {
    await cacheImages(db, dir, okFetch());
    await db.update(images).set({ tileBg: "#102030" }).where(eq(images.url, ICON));
    expect((await loadImageMap(db)).get(ICON)?.tileBg).toBe("#102030");
  });

  it("serves the thumbnail by default, the original when absent or when asked", () => {
    const map = new Map([
      [ICON, { path: "psn/ab.png", thumb: "psn/thumb/ab.webp", tileBg: null }],
      [COVER, { path: "psn/cd.jpg", thumb: null, tileBg: null }],
    ]);
    expect(mediaSrc(ICON, map)).toBe("/media/psn/thumb/ab.webp");
    expect(mediaSrc(ICON, map, "thumb")).toBe("/media/psn/thumb/ab.webp");
    expect(mediaSrc(ICON, map, "full")).toBe("/media/psn/ab.png");
    expect(mediaSrc(COVER, map)).toBe("/media/psn/cd.jpg");
    expect(mediaSrc(COVER, map, "full")).toBe("/media/psn/cd.jpg");
  });

  it("falls back to the placeholder for unknown or null urls", () => {
    const map = new Map([[ICON, { path: "psn/ab.png", thumb: null, tileBg: null }]]);
    expect(mediaSrc("https://other/x.png", map)).toBe("/icons/placeholder.svg");
    expect(mediaSrc(null, map)).toBe("/icons/placeholder.svg");
    expect(mediaSrc("https://other/x.png", map, "full")).toBe("/icons/placeholder.svg");
  });
});

describe("site-side module", () => {
  it("does not import the thumbnail code or sharp", () => {
    const source = readFileSync(path.join(process.cwd(), "src/sync/images.ts"), "utf8");
    expect(source).not.toMatch(/sync\/thumbs|from "sharp"|import\("sharp"\)/);
  });
});

describe("resolveMediaPath", () => {
  const root = path.resolve("/data/media");
  it("resolves files under psn/ and banner/", () => {
    expect(resolveMediaPath(root, ["psn", "a.png"])).toBe(path.join(root, "psn", "a.png"));
    expect(resolveMediaPath(root, ["banner", "b.webp"])).toBe(path.join(root, "banner", "b.webp"));
  });
  it.each([
    [["psn", "..", "..", "secret.png"]],
    [["..", "x.png"]],
    [["psn", ".."]],
    [["psn", "a/b.png"]],
    [["psn", "a\\b.png"]],
    [["psn", "..%2f..%2fx.png"]],
    [["psn", "a\0.png"]],
    [["/etc/passwd"]],
    [["C:", "x.png"]],
    [["psn", ""]],
    [["other", "a.png"]],
    [["psn"]],
    [[]],
  ])("rejects %j", (segments) => {
    expect(resolveMediaPath(root, segments)).toBeNull();
  });
});
