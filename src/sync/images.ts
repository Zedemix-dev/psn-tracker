import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { and, inArray, isNotNull, sql } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { images, profile, titles, trophies, trophyGroups } from "@/src/db/schema";

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

/** Local `/media/...` url of a cached image, else the placeholder. */
export function mediaSrc(url: string | null, cached: Map<string, string>): string {
  const local = url ? cached.get(url) : undefined;
  return local ? `/media/${local}` : PLACEHOLDER;
}

/** url -> path relative to mediaDir, for downloaded images only. */
export async function loadImageMap(db: Db): Promise<Map<string, string>> {
  const rows = await db
    .select({ url: images.url, localPath: images.localPath })
    .from(images)
    .where(isNotNull(images.localPath));
  return new Map(rows.map((r) => [r.url, r.localPath!]));
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
    db.select({ u: trophyGroups.iconUrl }).from(trophyGroups),
    db.select({ u: trophies.iconUrl }).from(trophies),
  ]);
  const all = new Set<string>();
  for (const rows of sources) for (const { u } of rows) if (u) all.add(u);
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

/**
 * Downloads every known PSN image that is not cached yet (4 at a time).
 * Failures only bump `attempts`; the next sync retries them.
 */
export async function cacheImages(
  db: Db,
  mediaDir: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ downloaded: number; failed: number }> {
  const urls = await collectUrls(db);
  const cached = new Set<string>();
  for (let i = 0; i < urls.length; i += CHUNK) {
    const rows = await db
      .select({ url: images.url })
      .from(images)
      .where(and(inArray(images.url, urls.slice(i, i + CHUNK)), isNotNull(images.localPath)));
    for (const r of rows) cached.add(r.url);
  }
  const queue = urls.filter((u) => !cached.has(u));
  let downloaded = 0;
  let failed = 0;
  const worker = async () => {
    for (let url = queue.pop(); url; url = queue.pop()) {
      if (await downloadOne(db, mediaDir, url, fetchImpl)) downloaded++;
      else failed++;
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
  return { downloaded, failed };
}
