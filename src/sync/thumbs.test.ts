import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { computeTileBg, makeThumb } from "@/src/sync/thumbs";

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

describe("computeTileBg", () => {
  const write = async (name: string, data: Buffer | string) => {
    const file = path.join(dir, name);
    await fs.writeFile(file, data);
    return file;
  };
  const rect = (w: number, h: number, background: string) =>
    sharp({ create: { width: w, height: h, channels: 4, background } });

  it("returns the colour of the two facing edges of a wide image", async () => {
    const logo = await sharp({ create: { width: 20, height: 10, channels: 4, background: "#ffcc00" } })
      .png()
      .toBuffer();
    const buf = await rect(40, 20, "#102030")
      .composite([{ input: logo, left: 10, top: 5 }])
      .png()
      .toBuffer();
    expect(await computeTileBg(await write("wide.png", buf))).toBe("#102030");
  });

  it("returns a split gradient when top and bottom differ", async () => {
    const bottom = await rect(40, 5, "#0000ff").png().toBuffer();
    const buf = await rect(40, 20, "#ff0000")
      .composite([{ input: bottom, left: 0, top: 15 }])
      .png()
      .toBuffer();
    expect(await computeTileBg(await write("split.png", buf))).toBe(
      "linear-gradient(#ff0000 50%, #0000ff 50%)",
    );
  });

  it("returns null for a square image", async () => {
    expect(await computeTileBg(await write("sq.png", await rect(20, 20, "#102030").png().toBuffer()))).toBeNull();
  });

  it("returns null for an SVG without loading it", async () => {
    const svg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"40\" height=\"20\"><rect width=\"40\" height=\"20\"/></svg>";
    expect(await computeTileBg(await write("a.svg", svg))).toBeNull();
  });

  it("rejects on a corrupt image", async () => {
    await expect(computeTileBg(await write("bad.png", Buffer.from([1, 2, 3])))).rejects.toThrow();
  });
});
