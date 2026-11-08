import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const MAX_BANNER_BYTES = 10 * 1024 * 1024;
export type BannerExt = "jpg" | "png" | "webp";

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);

/** Checks the file signature (not the name or MIME type) and the 10 MB limit. */
export function validateBannerUpload(
  bytes: Uint8Array,
  declaredSize: number,
): { ok: true; ext: BannerExt } | { ok: false; error: string } {
  if (declaredSize > MAX_BANNER_BYTES || bytes.length > MAX_BANNER_BYTES) {
    return { ok: false, error: "Images must be 10 MB or smaller." };
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { ok: true, ext: "jpg" };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ok: true, ext: "png" };
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return { ok: true, ext: "webp" };
  }
  return { ok: false, error: "Use a JPEG, PNG or WebP image." };
}

/** Writes mediaDir/banner/<16 hex>.<ext> atomically; returns the path relative to mediaDir. */
export async function storeBannerFile(mediaDir: string, bytes: Uint8Array, ext: BannerExt): Promise<string> {
  const dir = path.join(mediaDir, "banner");
  await fs.mkdir(dir, { recursive: true });
  const name = `${randomBytes(8).toString("hex")}.${ext}`;
  const tmp = path.join(dir, `.${name}.tmp`);
  try {
    await fs.writeFile(tmp, bytes);
    await fs.rename(tmp, path.join(dir, name));
  } catch (e) {
    await fs.rm(tmp, { force: true });
    throw e;
  }
  return `banner/${name}`;
}

/** Deletes a previously stored banner. Silently ignores null, a missing file or a path outside banner/. */
export async function removeBannerFile(mediaDir: string, relPath: string | null): Promise<void> {
  if (!relPath || !/^banner\/[A-Za-z0-9._-]+$/.test(relPath) || relPath.includes("..")) return;
  await fs.rm(path.join(mediaDir, relPath), { force: true });
}
