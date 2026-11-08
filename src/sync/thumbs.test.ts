import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeThumb } from "@/src/sync/thumbs";

let dir: string;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "thumbs-"));
});
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

const png = (size: number) =>
  sharp({ create: { width: size, height: size, channels: 3, background: "#336699" } })
    .png()
    .toBuffer();

describe("makeThumb", () => {
  it("shrinks a 1024x1024 PNG to a WebP that fits in 192x192", async () => {
    const src = path.join(dir, "big.png");
    const out = path.join(dir, "thumb", "big.webp");
    await fs.writeFile(src, await png(1024));
    await makeThumb(src, out);
    const meta = await sharp(await fs.readFile(out)).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(192);
    expect(meta.height).toBe(192);
    expect((await fs.readdir(path.dirname(out))).filter((f) => f.endsWith(".tmp"))).toEqual([]);
  });

  it("does not enlarge an image smaller than 192", async () => {
    const src = path.join(dir, "small.png");
    const out = path.join(dir, "small.webp");
    await fs.writeFile(src, await png(64));
    await makeThumb(src, out);
    const meta = await sharp(await fs.readFile(out)).metadata();
    expect(meta.width).toBe(64);
    expect(meta.height).toBe(64);
  });

  it("rejects on a corrupt image and leaves no file behind", async () => {
    const src = path.join(dir, "bad.png");
    const out = path.join(dir, "bad.webp");
    await fs.writeFile(src, Buffer.from([1, 2, 3]));
    await expect(makeThumb(src, out)).rejects.toThrow();
    expect(await fs.readdir(dir)).toEqual(["bad.png"]);
  });
});
