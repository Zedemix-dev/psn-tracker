import { createHash } from "node:crypto";
import path from "node:path";
import { isNotNull } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { images } from "@/src/db/schema";

const PLACEHOLDER = "/icons/placeholder.svg";
const SERVED_DIRS = ["psn", "banner"];

export const imageHash = (url: string) => createHash("sha256").update(url).digest("hex");

export type ImageMap = Map<string, { path: string; thumb: string | null; tileBg: string | null }>;

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

/** Stored edge colour of a cached image, for its square tile; null when unknown or not cached. */
export function tileBgOf(url: string | null, cached: ImageMap): string | null {
  return (url ? cached.get(url)?.tileBg : null) ?? null;
}

/** url -> files relative to mediaDir, for downloaded images only. */
export async function loadImageMap(db: Db): Promise<ImageMap> {
  const rows = await db
    .select({ url: images.url, localPath: images.localPath, thumbPath: images.thumbPath, tileBg: images.tileBg })
    .from(images)
    .where(isNotNull(images.localPath));
  return new Map(rows.map((r) => [r.url, { path: r.localPath!, thumb: r.thumbPath, tileBg: r.tileBg }]));
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
