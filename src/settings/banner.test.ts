import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { removeBannerFile, storeBannerFile, validateBannerUpload } from "@/src/settings/banner";

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);
const PDF = new TextEncoder().encode("%PDF-1.7\n...");
const MB10 = 10 * 1024 * 1024;

describe("validateBannerUpload", () => {
  it("accepts PNG, JPEG and WebP by signature", () => {
    expect(validateBannerUpload(PNG, PNG.length)).toEqual({ ok: true, ext: "png" });
    expect(validateBannerUpload(JPG, JPG.length)).toEqual({ ok: true, ext: "jpg" });
    expect(validateBannerUpload(WEBP, WEBP.length)).toEqual({ ok: true, ext: "webp" });
  });

  it("rejects a PDF whatever its name", () => {
    expect(validateBannerUpload(PDF, PDF.length)).toEqual({ ok: false, error: "Use a JPEG, PNG or WebP image." });
  });

  it("rejects RIFF files that are not WebP", () => {
    const wav = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45]);
    expect(validateBannerUpload(wav, wav.length).ok).toBe(false);
  });

  it("rejects an empty file", () => {
    expect(validateBannerUpload(new Uint8Array(0), 0)).toEqual({ ok: false, error: "Use a JPEG, PNG or WebP image." });
  });

  it("accepts exactly 10 MB and rejects 10 MB + 1 byte", () => {
    expect(validateBannerUpload(PNG, MB10).ok).toBe(true);
    expect(validateBannerUpload(PNG, MB10 + 1)).toEqual({ ok: false, error: "Images must be 10 MB or smaller." });
  });
});

describe("banner storage", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "banner-"));
  });
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("writes banner/<16 hex>.<ext> without leaving temp files", async () => {
    const rel = await storeBannerFile(dir, PNG, "png");
    expect(rel).toMatch(/^banner\/[0-9a-f]{16}\.png$/);
    expect(new Uint8Array(await fs.readFile(path.join(dir, rel)))).toEqual(PNG);
    expect(await fs.readdir(path.join(dir, "banner"))).toEqual([path.basename(rel)]);
  });

  it("removes a stored file and ignores a missing one or an unsafe path", async () => {
    const rel = await storeBannerFile(dir, JPG, "jpg");
    await removeBannerFile(dir, rel);
    expect(await fs.readdir(path.join(dir, "banner"))).toEqual([]);
    await expect(removeBannerFile(dir, rel)).resolves.toBeUndefined();
    await expect(removeBannerFile(dir, "banner/../../x")).resolves.toBeUndefined();
    await expect(removeBannerFile(dir, null)).resolves.toBeUndefined();
  });
});
