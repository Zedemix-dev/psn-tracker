import fs from "node:fs/promises";
import path from "node:path";

import { edgeBackground } from "@/src/lib/tile-bg";

export const THUMB_SIZE = 192;
const THUMB_QUALITY = 80;

/**
 * Writes a WebP thumbnail (fits in 192x192, never enlarged) of `source` to `target`,
 * atomically. sharp is imported dynamically so it is only loaded on the paths that use it.
 */
export async function makeThumb(source: string, target: string): Promise<void> {
  const { default: sharp } = await import("sharp");
  const tmp = `${target}.${process.pid}.tmp`;
  try {
    await fs.mkdir(path.dirname(target), { recursive: true });
    await sharp(await fs.readFile(source))
      .resize(THUMB_SIZE, THUMB_SIZE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: THUMB_QUALITY })
      .toFile(tmp);
    await fs.rename(tmp, target);
  } catch (error) {
    await fs.rm(tmp, { force: true });
    throw error;
  }
}

/**
 * Tile colour of a cached image (spec 8.9): the `edgeBackground` of its raw RGBA pixels.
 * Null for an SVG (not read) or an image without bands to fill; rejects on an unreadable file.
 */
export async function computeTileBg(file: string): Promise<string | null> {
  if (path.extname(file).toLowerCase() === ".svg") return null;
  const { default: sharp } = await import("sharp");
  const { data, info } = await sharp(await fs.readFile(file))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return edgeBackground(data, info.width, info.height);
}
