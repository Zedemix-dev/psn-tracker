import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/src/db/client";
import { images, profile, titles } from "@/src/db/schema";
import { upsertTitleRow } from "@/src/sync/title";
import {
  cacheImages,
  imageHash,
  loadImageMap,
  mediaSrc,
  resolveMediaPath,
} from "@/src/sync/images";
import { makeRemoteTitle } from "@/tests/fixtures/titles";
import { createTestDb } from "@/tests/helpers/db";

const now = new Date("2026-01-01T00:00:00Z");
const ICON = "https://image.api.playstation.com/icon1.png";
const COVER = "https://image.api.playstation.com/cover1.jpg?x=1";

let db: Db;
let dir: string;
beforeEach(async () => {
  db = await createTestDb();
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "media-"));
  await upsertTitleRow(db, makeRemoteTitle({ npCommunicationId: "NPWR00001_00" }), now);
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

describe("cacheImages", () => {
  it("downloads each url once across two calls", async () => {
    const f = okFetch();
    const first = await cacheImages(db, dir, f);
    const calls = f.mock.calls.length;
    const second = await cacheImages(db, dir, f);
    expect(first.failed).toBe(0);
    expect(first.downloaded).toBeGreaterThanOrEqual(2);
    expect(calls).toBe(first.downloaded);
    expect(f.mock.calls.length).toBe(calls);
    expect(second).toMatchObject({ downloaded: 0, failed: 0 });
  });

  it("stores files under psn/<sha256>.<ext> with a relative localPath", async () => {
    await cacheImages(db, dir, okFetch());
    const [row] = await db.select().from(images).where(eq(images.url, ICON));
    expect(row.localPath).toBe(`psn/${imageHash(ICON)}.png`);
    expect(row.fetchedAt).not.toBeNull();
    expect(await fs.readFile(path.join(dir, row.localPath!))).toEqual(Buffer.from([1, 2, 3]));
    const [cover] = await db.select().from(images).where(eq(images.url, COVER));
    expect(cover.localPath).toMatch(/\.jpg$/);
    const files = await fs.readdir(path.join(dir, "psn"));
    expect(files.some((f) => f.endsWith(".tmp"))).toBe(false);
  });

  it("falls back to the Content-Type when the url has no known extension", async () => {
    await db.update(titles).set({ coverUrl: "https://x/cover" });
    const f = vi.fn(
      async () => new Response(new Uint8Array([1]), { status: 200, headers: { "content-type": "image/webp" } }),
    );
    await cacheImages(db, dir, f);
    const [row] = await db.select().from(images).where(eq(images.url, "https://x/cover"));
    expect(row.localPath).toMatch(/\.webp$/);
  });

  it("collects the profile avatar too", async () => {
    await db.update(profile).set({ avatarUrl: "https://x/avatar.png" });
    await cacheImages(db, dir, okFetch());
    const [row] = await db.select().from(images).where(eq(images.url, "https://x/avatar.png"));
    expect(row.localPath).not.toBeNull();
  });

  it("counts a 404 as failed, keeps localPath null and increments attempts", async () => {
    const f = vi.fn(async () => new Response("no", { status: 404 }));
    const r = await cacheImages(db, dir, f);
    expect(r.downloaded).toBe(0);
    expect(r.failed).toBeGreaterThanOrEqual(2);
    const [row] = await db.select().from(images).where(eq(images.url, ICON));
    expect(row.localPath).toBeNull();
    expect(row.attempts).toBe(1);
    await cacheImages(db, dir, f);
    const [again] = await db.select().from(images).where(eq(images.url, ICON));
    expect(again.attempts).toBe(2);
  });

  it("survives network errors and retries on the next sync", async () => {
    const bad = vi.fn(async () => {
      throw new Error("boom");
    });
    const r = await cacheImages(db, dir, bad);
    expect(r.downloaded).toBe(0);
    expect(r.failed).toBeGreaterThanOrEqual(2);
    const ok = await cacheImages(db, dir, okFetch());
    expect(ok.failed).toBe(0);
    expect(ok.downloaded).toBe(r.failed);
  });

  it("never runs more than 4 downloads at once", async () => {
    for (let i = 0; i < 12; i++) {
      const id = `NPWR1${i}_00`;
      await upsertTitleRow(db, makeRemoteTitle({ npCommunicationId: id }), now);
      await db
        .update(titles)
        .set({ iconUrl: `https://x/t${i}.png` })
        .where(eq(titles.npCommunicationId, id));
    }
    let active = 0;
    let max = 0;
    const f = vi.fn(async () => {
      active++;
      max = Math.max(max, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return new Response(new Uint8Array([1]), { status: 200 });
    });
    await cacheImages(db, dir, f);
    expect(max).toBeLessThanOrEqual(4);
    expect(max).toBeGreaterThan(1);
  });
});

const pngFetch = async () => {
  const bytes = await sharp({
    create: { width: 400, height: 400, channels: 3, background: "#aa5522" },
  })
    .png()
    .toBuffer();
  return vi.fn(
    async (_url: string | URL | Request) =>
      new Response(new Uint8Array(bytes), { status: 200, headers: { "content-type": "image/png" } }),
  );
};

describe("cacheImages thumbnails", () => {
  it("creates psn/thumb/<hash>.webp after a download", async () => {
    const r = await cacheImages(db, dir, await pngFetch());
    const [row] = await db.select().from(images).where(eq(images.url, ICON));
    expect(row.thumbPath).toBe(`psn/thumb/${imageHash(ICON)}.webp`);
    const meta = await sharp(await fs.readFile(path.join(dir, row.thumbPath!))).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(192);
    expect(r.thumbs).toBe(r.downloaded);
    expect(r.thumbsFailed).toBe(0);
  });

  it("catches up rows that have a file but no thumbnail, without downloading", async () => {
    const f = await pngFetch();
    const first = await cacheImages(db, dir, f);
    await db.update(images).set({ thumbPath: null });
    await fs.rm(path.join(dir, "psn", "thumb"), { recursive: true });
    const r = await cacheImages(db, dir, f);
    expect(f.mock.calls.length).toBe(first.downloaded);
    expect(r.downloaded).toBe(0);
    expect(r.thumbs).toBe(first.downloaded);
    const [row] = await db.select().from(images).where(eq(images.url, ICON));
    expect(row.thumbPath).toBe(`psn/thumb/${imageHash(ICON)}.webp`);
    await expect(fs.stat(path.join(dir, row.thumbPath!))).resolves.toBeTruthy();
  });

  it("keeps thumbPath null for a corrupt image and does not throw", async () => {
    const junk = Uint8Array.from({ length: 200 }, (_, i) => (i * 37) % 251);
    const f = vi.fn(
      async () => new Response(junk, { status: 200, headers: { "content-type": "image/png" } }),
    );
    await db.update(titles).set({ coverUrl: null });
    const r = await cacheImages(db, dir, f);
    expect(r).toEqual({ downloaded: 1, failed: 0, thumbs: 0, thumbsFailed: 1 });
    const [row] = await db.select().from(images).where(eq(images.url, ICON));
    expect(row.localPath).not.toBeNull();
    expect(row.thumbPath).toBeNull();
  });
});

describe("loadImageMap / mediaSrc", () => {
  it("maps only cached images", async () => {
    await cacheImages(db, dir, okFetch());
    await db.insert(images).values({ url: "https://x/pending.png" });
    const map = await loadImageMap(db);
    expect(map.get(ICON)).toEqual({ path: `psn/${imageHash(ICON)}.png`, thumb: null });
    expect(map.has("https://x/pending.png")).toBe(false);
  });

  it("serves the thumbnail by default, the original when absent or when asked", () => {
    const map = new Map([
      [ICON, { path: "psn/ab.png", thumb: "psn/thumb/ab.webp" }],
      [COVER, { path: "psn/cd.jpg", thumb: null }],
    ]);
    expect(mediaSrc(ICON, map)).toBe("/media/psn/thumb/ab.webp");
    expect(mediaSrc(ICON, map, "thumb")).toBe("/media/psn/thumb/ab.webp");
    expect(mediaSrc(ICON, map, "full")).toBe("/media/psn/ab.png");
    expect(mediaSrc(COVER, map)).toBe("/media/psn/cd.jpg");
    expect(mediaSrc(COVER, map, "full")).toBe("/media/psn/cd.jpg");
  });

  it("falls back to the placeholder for unknown or null urls", () => {
    const map = new Map([[ICON, { path: "psn/ab.png", thumb: null }]]);
    expect(mediaSrc("https://other/x.png", map)).toBe("/icons/placeholder.svg");
    expect(mediaSrc(null, map)).toBe("/icons/placeholder.svg");
    expect(mediaSrc("https://other/x.png", map, "full")).toBe("/icons/placeholder.svg");
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
