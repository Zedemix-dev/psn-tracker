import fs from "node:fs/promises";
import path from "node:path";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { BANNER_OVERRIDES } from "@/src/games/banner-overrides";
import { gameKey } from "@/src/games/siblings";
import { images, playedGames, profile, titles, trophies, trophyGroups } from "@/src/db/schema";
import { imageHash } from "@/src/sync/images";
import { computeTileBg, makeThumb } from "@/src/sync/thumbs";

// Worker only: this module reaches sharp (through thumbs.ts), the site never imports it.
const CONCURRENCY = 4;
// Postgres caps bind parameters per statement.
const CHUNK = 500;
// A download (headers and body) that takes longer counts as failed, and is retried next sync.
export const IMAGE_TIMEOUT_MS = 30_000;
const EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "svg"];
const CONTENT_TYPE_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

function extensionOf(url: string, contentType: string | null): string {
  try {
    const ext = path.extname(new URL(url).pathname).slice(1).toLowerCase();
    if (EXTENSIONS.includes(ext)) return ext;
  } catch {
    // fall through to the Content-Type
  }
  const type = contentType?.split(";")[0].trim().toLowerCase();
  return (type && CONTENT_TYPE_EXT[type]) || "png";
}

async function collectUrls(db: Db): Promise<string[]> {
  const sources = await Promise.all([
    db.select({ u: profile.avatarUrl }).from(profile),
    db.select({ u: titles.iconUrl }).from(titles),
    db.select({ u: titles.coverUrl }).from(titles),
    db.select({ u: titles.bannerUrl }).from(titles),
    db.select({ u: titles.logoUrl }).from(titles),
    db.select({ u: trophyGroups.iconUrl }).from(trophyGroups),
    db.select({ u: trophies.iconUrl }).from(trophies),
  ]);
  const all = new Set<string>();
  for (const rows of sources) for (const { u } of rows) if (u) all.add(u);
  // Hand-picked banners (spec 8.9) of every game, hidden ones included: `pruneImages` keeps
  // exactly what this function collects, so a hidden game that comes back keeps its banner.
  const named = await db.select({ name: titles.name }).from(titles);
  for (const { name } of named) {
    const url = BANNER_OVERRIDES[gameKey(name)];
    if (url) all.add(url);
  }
  return [...all];
}

async function downloadOne(
  db: Db,
  mediaDir: string,
  url: string,
  fetchImpl: typeof fetch,
): Promise<boolean> {
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    const rel = `psn/${imageHash(url)}.${extensionOf(url, res.headers.get("content-type"))}`;
    const target = path.join(mediaDir, rel);
    const tmp = `${target}.${process.pid}.tmp`;
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(tmp, bytes);
    await fs.rename(tmp, target);
    const fetchedAt = new Date();
    await db
      .insert(images)
      .values({ url, localPath: rel, fetchedAt })
      .onConflictDoUpdate({ target: images.url, set: { localPath: rel, fetchedAt } });
    return true;
  } catch {
    await db
      .insert(images)
      .values({ url, attempts: 1 })
      .onConflictDoUpdate({
        target: images.url,
        set: { attempts: sql`${images.attempts} + 1` },
      });
    return false;
  }
}

async function thumbOne(db: Db, mediaDir: string, url: string, localPath: string): Promise<boolean> {
  try {
    const rel = `psn/thumb/${imageHash(url)}.webp`;
    await makeThumb(path.join(mediaDir, localPath), path.join(mediaDir, rel));
    await db.update(images).set({ thumbPath: rel }).where(eq(images.url, url));
    return true;
  } catch {
    return false;
  }
}

async function tileOne(db: Db, mediaDir: string, url: string, localPath: string): Promise<boolean> {
  try {
    const tileBg = await computeTileBg(path.join(mediaDir, localPath));
    await db.update(images).set({ tileBg, tileCheckedAt: new Date() }).where(eq(images.url, url));
    return true;
  } catch {
    return false;
  }
}

/** Runs `task` over `items`, `CONCURRENCY` at a time. */
async function inPool<T>(items: T[], task: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  const worker = async () => {
    for (let item = queue.pop(); item !== undefined; item = queue.pop()) await task(item);
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
}

/** Deletes `rel` under `mediaDir`, only when it is a `psn/` file that resolves inside it. */
async function removeFile(mediaDir: string, rel: string | null): Promise<void> {
  if (!rel || !rel.startsWith("psn/")) return;
  const root = path.resolve(mediaDir);
  const full = path.resolve(root, rel);
  if (!full.startsWith(path.join(root, "psn") + path.sep)) return;
  try {
    await fs.unlink(full);
  } catch {
    // Already gone, or not removable: a leftover file is harmless.
  }
}

/**
 * Removes the `images` rows no known URL points to any more, with their file and thumbnail
 * (`psn/` only: the user's own banner under `banner/` is never touched). Returns the number of
 * rows removed. When in doubt an image is kept: the played-games URLs, which `collectUrls` does
 * not download, are kept too.
 */
export async function pruneImages(db: Db, mediaDir: string): Promise<number> {
  const keep = new Set(await collectUrls(db));
  const played = await Promise.all([
    db.select({ u: playedGames.imageUrl }).from(playedGames),
    db.select({ u: playedGames.bannerUrl }).from(playedGames),
    db.select({ u: playedGames.logoUrl }).from(playedGames),
  ]);
  for (const rows of played) for (const { u } of rows) if (u) keep.add(u);

  const all = await db
    .select({ url: images.url, localPath: images.localPath, thumbPath: images.thumbPath })
    .from(images);
  const orphans = all.filter((r) => !keep.has(r.url));
  if (orphans.length === 0) return 0;
  const keptPaths = new Set<string>();
  for (const r of all) {
    if (!keep.has(r.url)) continue;
    if (r.localPath) keptPaths.add(r.localPath);
    if (r.thumbPath) keptPaths.add(r.thumbPath);
  }

  for (let i = 0; i < orphans.length; i += CHUNK) {
    await db.delete(images).where(
      inArray(
        images.url,
        orphans.slice(i, i + CHUNK).map((r) => r.url),
      ),
    );
  }
  for (const r of orphans) {
    for (const rel of [r.localPath, r.thumbPath]) {
      if (rel && !keptPaths.has(rel)) await removeFile(mediaDir, rel);
    }
  }
  return orphans.length;
}

/**
 * Downloads every known PSN image that is not cached yet (4 at a time), then gives a
 * thumbnail to every cached image that lacks one, then a tile colour (spec 8.9) to every
 * cached image never checked (new downloads and earlier syncs alike).
 * Failures only bump `attempts` (download) or leave `thumb_path` / `tile_checked_at` null
 * (thumbnail, tile colour): the next sync retries all three.
 */
export async function cacheImages(
  db: Db,
  mediaDir: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ downloaded: number; failed: number; thumbs: number; thumbsFailed: number; tiles: number }> {
  const urls = await collectUrls(db);
  const cached = new Set<string>();
  for (let i = 0; i < urls.length; i += CHUNK) {
    const rows = await db
      .select({ url: images.url })
      .from(images)
      .where(and(inArray(images.url, urls.slice(i, i + CHUNK)), isNotNull(images.localPath)));
    for (const r of rows) cached.add(r.url);
  }
  let downloaded = 0;
  let failed = 0;
  await inPool(
    urls.filter((u) => !cached.has(u)),
    async (url) => {
      if (await downloadOne(db, mediaDir, url, fetchImpl)) downloaded++;
      else failed++;
    },
  );

  const missing = await db
    .select({ url: images.url, localPath: images.localPath })
    .from(images)
    .where(and(isNotNull(images.localPath), isNull(images.thumbPath)));
  let thumbs = 0;
  let thumbsFailed = 0;
  await inPool(missing, async ({ url, localPath }) => {
    if (await thumbOne(db, mediaDir, url, localPath!)) thumbs++;
    else thumbsFailed++;
  });

  const unchecked = await db
    .select({ url: images.url, localPath: images.localPath })
    .from(images)
    .where(and(isNotNull(images.localPath), isNull(images.tileCheckedAt)));
  let tiles = 0;
  await inPool(unchecked, async ({ url, localPath }) => {
    if (await tileOne(db, mediaDir, url, localPath!)) tiles++;
  });
  return { downloaded, failed, thumbs, thumbsFailed, tiles };
}
