import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { BANNER_OVERRIDES } from "@/src/games/banner-overrides";
import { gameKey } from "@/src/games/siblings";
import { images, profile, titles, trophies, trophyGroups } from "@/src/db/schema";
import { makeThumb } from "@/src/sync/thumbs";

const PLACEHOLDER = "/icons/placeholder.svg";
const CONCURRENCY = 4;
// Postgres caps bind parameters per statement.
const CHUNK = 500;
const SERVED_DIRS = ["psn", "banner"];
const EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "svg"];
const CONTENT_TYPE_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

export const imageHash = (url: string) => createHash("sha256").update(url).digest("hex");

export type ImageMap = Map<string, { path: string; thumb: string | null }>;

/** Local `/media/...` url of a cached image (its thumbnail by default), else the placeholder. */
export function mediaSrc(
  url: string | null,
  cached: ImageMap,
  size: "thumb" | "full" = "thumb",
): string {
  const entry = url ? cached.get(url) : undefined;
  if (!entry) return PLACEHOLDER;
  return `/media/${size === "thumb" && entry.thumb ? entry.thumb : entry.path}`;
}

/** url -> files relative to mediaDir, for downloaded images only. */
export async function loadImageMap(db: Db): Promise<ImageMap> {
  const rows = await db
    .select({ url: images.url, localPath: images.localPath, thumbPath: images.thumbPath })
    .from(images)
    .where(isNotNull(images.localPath));
  return new Map(rows.map((r) => [r.url, { path: r.localPath!, thumb: r.thumbPath }]));
}

/**
 * Maps request path segments to a file under mediaDir/psn or mediaDir/banner.
 * Returns null for anything that could escape them or lies outside those folders.
 */
export function resolveMediaPath(mediaDir: string, segments: string[]): string | null {
  if (segments.length < 2 || !SERVED_DIRS.includes(segments[0])) return null;
  for (const s of segments) {
    if (s === "" || s === "." || s === "..") return null;
    if (/[\\/:\0%]/.test(s)) return null;
  }
  const root = path.resolve(mediaDir);
  const full = path.resolve(root, ...segments);
  return full.startsWith(root + path.sep) ? full : null;
}

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
  // Hand-picked banners (spec 8.9) of visible games.
  const visible = await db.select({ name: titles.name }).from(titles).where(eq(titles.hidden, false));
  for (const { name } of visible) {
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
    const res = await fetchImpl(url);
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

/** Runs `task` over `items`, `CONCURRENCY` at a time. */
async function inPool<T>(items: T[], task: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  const worker = async () => {
    for (let item = queue.pop(); item !== undefined; item = queue.pop()) await task(item);
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
}

/**
 * Downloads every known PSN image that is not cached yet (4 at a time), then gives a
 * thumbnail to every cached image that lacks one (new downloads and earlier syncs alike).
 * Failures only bump `attempts` (download) or leave `thumb_path` null (thumbnail):
 * the next sync retries both.
 */
export async function cacheImages(
  db: Db,
  mediaDir: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ downloaded: number; failed: number; thumbs: number; thumbsFailed: number }> {
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
  return { downloaded, failed, thumbs, thumbsFailed };
}
