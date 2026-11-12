import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/src/db/client";
import { images, playedGames, profile, titles, trophies, trophyGroups } from "@/src/db/schema";
import { upsertTitleRow } from "@/src/sync/title";
import { cacheImages, IMAGE_TIMEOUT_MS, pruneImages } from "@/src/sync/image-cache";
import { imageHash } from "@/src/sync/images";
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
  it("collects the game banner and logo", async () => {
    const BANNER = "https://image.api.playstation.com/banner1.jpg";
    const LOGO = "https://image.api.playstation.com/logo1.png";
    await db
      .update(titles)
      .set({ bannerUrl: BANNER, logoUrl: LOGO })
      .where(eq(titles.npCommunicationId, "NPWR00001_00"));
    const f = okFetch();
    await cacheImages(db, dir, f);
    const urls = f.mock.calls.map((c) => String(c[0]));
    expect(urls).toContain(BANNER);
    expect(urls).toContain(LOGO);
  });

  it("downloads the hand-picked banner of every game, hidden ones included", async () => {
    const GOT = "https://img.psnprofiles.com/hero/l/3220/31500c21-cc5e-4d31-bfcc-9c10cbb55249.jpg";
    await db
      .update(titles)
      .set({ name: "Game of Thrones" })
      .where(eq(titles.npCommunicationId, "NPWR00001_00"));
    const f = okFetch();
    await cacheImages(db, dir, f);
    expect(f.mock.calls.map((c) => String(c[0]))).toContain(GOT);

    const dir2 = await fs.mkdtemp(path.join(os.tmpdir(), "media-"));
    await db
      .update(titles)
      .set({ hidden: true })
      .where(eq(titles.npCommunicationId, "NPWR00001_00"));
    await db.delete(images);
    const g = okFetch();
    await cacheImages(db, dir2, g);
    await fs.rm(dir2, { recursive: true, force: true });
    expect(g.mock.calls.map((c) => String(c[0]))).toContain(GOT);
  });

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

  it("downloads with a 30 s timeout signal", async () => {
    const f = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(new Uint8Array([1]), { status: 200 }));
    await cacheImages(db, dir, f);
    const init = f.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.signal!.aborted).toBe(false);
    expect(IMAGE_TIMEOUT_MS).toBe(30_000);
  });

  it("a timed-out download counts as failed and is retried next time", async () => {
    const slow = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
      throw new DOMException("slow", "TimeoutError");
    });
    const r = await cacheImages(db, dir, slow);
    expect(r.downloaded).toBe(0);
    expect(r.failed).toBeGreaterThanOrEqual(2);
    const [row] = await db.select().from(images).where(eq(images.url, ICON));
    expect(row.attempts).toBe(1);
    expect(row.localPath).toBeNull();
    expect(await fs.readdir(path.join(dir, "psn")).catch(() => [])).toEqual([]);
    const ok = await cacheImages(db, dir, okFetch());
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
    expect(r).toEqual({ downloaded: 1, failed: 0, thumbs: 0, thumbsFailed: 1, tiles: 0 });
    const [row] = await db.select().from(images).where(eq(images.url, ICON));
    expect(row.localPath).not.toBeNull();
    expect(row.thumbPath).toBeNull();
  });
});

describe("cacheImages tile colours", () => {
  const wideFetch = async () => {
    const bytes = await sharp({ create: { width: 40, height: 20, channels: 4, background: "#102030" } })
      .png()
      .toBuffer();
    return vi.fn(
      async (_url: string | URL | Request) =>
        new Response(new Uint8Array(bytes), { status: 200, headers: { "content-type": "image/png" } }),
    );
  };

  it("stores the tile colour and check date of a downloaded image, once", async () => {
    const f = await wideFetch();
    const first = await cacheImages(db, dir, f);
    expect(first.tiles).toBe(first.downloaded);
    const [row] = await db.select().from(images).where(eq(images.url, ICON));
    expect(row.tileBg).toBe("#102030");
    expect(row.tileCheckedAt).not.toBeNull();

    await db.update(images).set({ tileBg: "#ffffff" });
    const second = await cacheImages(db, dir, f);
    expect(second.tiles).toBe(0);
    const [again] = await db.select().from(images).where(eq(images.url, ICON));
    expect(again.tileBg).toBe("#ffffff");
  });

  it("marks a square image as checked with no colour", async () => {
    await cacheImages(db, dir, await pngFetch());
    const [row] = await db.select().from(images).where(eq(images.url, ICON));
    expect(row.tileBg).toBeNull();
    expect(row.tileCheckedAt).not.toBeNull();
  });

  it("leaves a corrupt image unchecked so the next sync retries it", async () => {
    const junk = Uint8Array.from({ length: 200 }, (_, i) => (i * 37) % 251);
    const f = vi.fn(async () => new Response(junk, { status: 200, headers: { "content-type": "image/png" } }));
    await cacheImages(db, dir, f);
    const [row] = await db.select().from(images).where(eq(images.url, ICON));
    expect(row.tileCheckedAt).toBeNull();
  });
});

describe("pruneImages", () => {
  const ORPHAN = "https://image.api.playstation.com/orphan.png";
  const AVATAR = "https://image.api.playstation.com/avatar.png";
  const GROUP_ICON = "https://image.api.playstation.com/group.png";
  const TROPHY_ICON = "https://image.api.playstation.com/trophy.png";
  const HIDDEN_ICON = "https://image.api.playstation.com/hidden.png";
  const GOT = "https://img.psnprofiles.com/hero/l/3220/31500c21-cc5e-4d31-bfcc-9c10cbb55249.jpg";

  async function seedImage(url: string, withThumb = true): Promise<{ file: string; thumb: string | null }> {
    const hash = imageHash(url);
    const file = `psn/${hash}.png`;
    const thumb = withThumb ? `psn/thumb/${hash}.webp` : null;
    await fs.mkdir(path.join(dir, "psn", "thumb"), { recursive: true });
    await fs.writeFile(path.join(dir, file), "x");
    if (thumb) await fs.writeFile(path.join(dir, thumb), "x");
    await db.insert(images).values({ url, localPath: file, thumbPath: thumb, fetchedAt: now });
    return { file, thumb };
  }
  const exists = (rel: string) =>
    fs.access(path.join(dir, rel)).then(
      () => true,
      () => false,
    );

  it("removes an orphan image: row, file and thumbnail", async () => {
    const { file, thumb } = await seedImage(ORPHAN);
    expect(await pruneImages(db, dir)).toBe(1);
    expect(await db.select().from(images).where(eq(images.url, ORPHAN))).toHaveLength(0);
    expect(await exists(file)).toBe(false);
    expect(await exists(thumb!)).toBe(false);
  });

  it("keeps what is still used, hidden games included", async () => {
    await db.update(profile).set({ avatarUrl: AVATAR });
    await db.insert(trophyGroups).values({ titleId: "NPWR00001_00", groupId: "default", name: "g", iconUrl: GROUP_ICON });
    await db
      .insert(trophies)
      .values({ titleId: "NPWR00001_00", trophyId: 0, type: "bronze", name: "t", iconUrl: TROPHY_ICON });
    await db
      .update(titles)
      .set({ iconUrl: HIDDEN_ICON, hidden: true, name: "Game of Thrones" })
      .where(eq(titles.npCommunicationId, "NPWR00001_00"));
    const kept = [AVATAR, GROUP_ICON, TROPHY_ICON, HIDDEN_ICON, COVER, GOT];
    const files: string[] = [];
    for (const url of kept) files.push((await seedImage(url)).file);
    await seedImage(ORPHAN);

    expect(await pruneImages(db, dir)).toBe(1);
    expect(await db.select().from(images)).toHaveLength(kept.length);
    for (const f of files) expect(await exists(f)).toBe(true);
  });

  it("keeps the images of the played games", async () => {
    const PLAYED = "https://image.api.playstation.com/played.png";
    await db.insert(playedGames).values({ npTitleId: "CUSA1", name: "p", imageUrl: PLAYED });
    const { file } = await seedImage(PLAYED);
    expect(await pruneImages(db, dir)).toBe(0);
    expect(await exists(file)).toBe(true);
  });

  it("never touches a file outside psn/, even one an orphan row points to", async () => {
    await fs.mkdir(path.join(dir, "banner"), { recursive: true });
    await fs.writeFile(path.join(dir, "banner", "mine.png"), "x");
    await fs.writeFile(path.join(dir, "outside.png"), "x");
    await db.insert(images).values([
      { url: ORPHAN, localPath: "banner/mine.png", thumbPath: "psn/../outside.png", fetchedAt: now },
    ]);
    expect(await pruneImages(db, dir)).toBe(1);
    expect(await exists("banner/mine.png")).toBe(true);
    expect(await exists("outside.png")).toBe(true);
  });

  it("is not an error when the file is already gone, and removes a row never downloaded", async () => {
    await db.insert(images).values([
      { url: ORPHAN, localPath: "psn/missing.png", thumbPath: "psn/thumb/missing.webp", fetchedAt: now },
      { url: `${ORPHAN}?2`, attempts: 2 },
    ]);
    expect(await pruneImages(db, dir)).toBe(2);
  });
});
