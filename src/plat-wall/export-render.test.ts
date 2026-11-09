import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { renderPlatWallPng, type ExportInput, type ExportTile } from "./export-render";

type Rgb = [number, number, number];

let dir: string;
const opaque = () => path.join(dir, "opaque.png");
const clear = () => path.join(dir, "clear.png");
const broken = () => path.join(dir, "broken.webp");
const bannerFile = () => path.join(dir, "banner.png");
const stripedBanner = () => path.join(dir, "striped.png");

const RED: Rgb = [220, 30, 40];

async function solid(file: string, width: number, height: number, background: Rgb | "clear") {
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: background === "clear" ? { r: 0, g: 0, b: 0, alpha: 0 } : { r: background[0], g: background[1], b: background[2], alpha: 1 },
    },
  })
    .png()
    .toFile(file);
}

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "plat-wall-export-"));
  await solid(opaque(), 192, 192, RED);
  await solid(clear(), 192, 192, "clear");
  await writeFile(broken(), "this is not an image");
  await solid(bannerFile(), 1920, 520, [224, 200, 40]);
  // Top half red, bottom half blue: tells which part of the banner is shown.
  const top = await sharp({ create: { width: 400, height: 400, channels: 3, background: { r: 255, g: 0, b: 0 } } }).png().toBuffer();
  await sharp({ create: { width: 400, height: 800, channels: 3, background: { r: 0, g: 0, b: 255 } } })
    .composite([{ input: top, left: 0, top: 0 }])
    .png()
    .toFile(stripedBanner());
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

const tile = (over: Partial<ExportTile> = {}): ExportTile => ({ file: opaque(), game: "Cyberpunk 2077", rate: 17.76, ...over });

function input(over: Partial<ExportInput> = {}): ExportInput {
  return {
    profile: {
      onlineId: "Zmx969",
      avatarFile: null,
      level: 536,
      levelProgress: 56,
      tier: 6,
      platinum: 230,
      gold: 990,
      silver: 2434,
      bronze: 7976,
    },
    stats: {
      gamesCompleted: 224,
      totalGames: 265,
      completionRate: 93.81,
      averageRarity: 26.55,
      unearned: 768,
      trophiesPerDay: 3.19,
      hoursSeconds: 67_690_800,
    },
    banner: null,
    tiles: [tile(), tile(), tile()],
    show: ["art"],
    ...over,
  };
}

async function pixel(png: Buffer, x: number, y: number): Promise<Rgb> {
  const data = await sharp(png).extract({ left: x, top: y, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
  return [data[0], data[1], data[2]];
}

async function brightest(png: Buffer, box: { left: number; top: number; width: number; height: number }): Promise<number> {
  const data = await sharp(png).extract(box).greyscale().removeAlpha().raw().toBuffer();
  return data.reduce((max, v) => Math.max(max, v), 0);
}

const closeTo = (actual: Rgb, expected: Rgb, tolerance = 3) =>
  actual.every((v, i) => Math.abs(v - expected[i]) <= tolerance);

// First tile: x 82, y 651, side 186. The gap between the first two tiles starts at x 268.
const CENTRE = [175, 744] as const;
const GAP = [281, 744] as const;
const CORNER = [83, 652] as const;

describe("renderPlatWallPng", () => {
  it("is a 2896 px wide PNG", async () => {
    const meta = await sharp(await renderPlatWallPng(input())).metadata();
    expect(meta.format).toBe("png");
    expect(meta.width).toBe(2896);
  });

  it("adds nothing behind a transparent thumbnail", async () => {
    const png = await renderPlatWallPng(input({ tiles: [tile({ file: clear() }), tile({ file: clear() })] }));
    expect(closeTo(await pixel(png, ...CENTRE), await pixel(png, ...GAP))).toBe(true);
  });

  it("rounds the corners of an opaque thumbnail", async () => {
    const png = await renderPlatWallPng(input());
    expect(closeTo(await pixel(png, ...CENTRE), RED)).toBe(true);
    expect(closeTo(await pixel(png, ...CORNER), await pixel(png, ...GAP))).toBe(true);
  });

  it.each([
    ["missing", () => null],
    ["unreadable", () => broken()],
    ["absent from the disk", () => path.join(dir, "nope.webp")],
  ])("draws the placeholder for a %s file", async (_name, file) => {
    const png = await renderPlatWallPng(input({ tiles: [tile({ file: file() })] }));
    expect(closeTo(await pixel(png, ...CENTRE), [0x2a, 0x31, 0x47])).toBe(true);
  });

  it("uses the plain background without a banner", async () => {
    const png = await renderPlatWallPng(input());
    expect(closeTo(await pixel(png, 0, 0), [0x0f, 0x16, 0x31])).toBe(true);
  });

  it("draws the banner when there is one", async () => {
    const png = await renderPlatWallPng(input({ banner: { file: bannerFile(), posY: 30 } }));
    expect(closeTo(await pixel(png, 0, 0), [224, 200, 40], 6)).toBe(true);
  });

  it("fades the banner into the blurred, darkened copy", async () => {
    const png = await renderPlatWallPng(input({ banner: { file: bannerFile(), posY: 30 } }));
    // CSS brightness(.4) saturate(1.25) of [224, 200, 40], below the sharp banner.
    const below = await pixel(png, 10, 900);
    expect(closeTo(below, [93, 81, 1], 3)).toBe(true);
    const start = await pixel(png, 10, 240);
    const middle = await pixel(png, 10, 304);
    const end = await pixel(png, 10, 378);
    expect(start[0]).toBeGreaterThan(middle[0]);
    expect(middle[0]).toBeGreaterThan(end[0]);
  });

  it.each([
    [0, [255, 0, 0]],
    [100, [0, 0, 255]],
  ] as [number, Rgb][])("shows the banner part chosen by posY %i", async (posY, colour) => {
    const png = await renderPlatWallPng(input({ banner: { file: stripedBanner(), posY } }));
    expect(closeTo(await pixel(png, 1448, 20), colour, 8)).toBe(true);
  });

  it("treats an unreadable banner as no banner", async () => {
    const png = await renderPlatWallPng(input({ banner: { file: broken(), posY: 30 } }));
    expect(closeTo(await pixel(png, 0, 0), [0x0f, 0x16, 0x31])).toBe(true);
  });

  it("draws the rarity and the name under the tile", async () => {
    const zone = { left: 82, top: 651 + 186 + 6, width: 186, height: 70 };
    const artOnly = await renderPlatWallPng(input());
    const full = await renderPlatWallPng(input({ show: ["art", "rarity", "name"] }));
    expect(await brightest(artOnly, zone)).toBeLessThan(80);
    expect(await brightest(full, zone)).toBeGreaterThan(150);
  });

  it("makes the image taller to fit the text", async () => {
    const artOnly = await sharp(await renderPlatWallPng(input())).metadata();
    const full = await sharp(await renderPlatWallPng(input({ show: ["art", "rarity", "name"] }))).metadata();
    expect(full.height).toBeGreaterThan(artOnly.height);
  });

  it("draws a card with centred text, and no art, when Art is off", async () => {
    const png = await renderPlatWallPng(input({ show: ["rarity", "name"] }));
    const cardCorner = await pixel(png, 95, 660);
    const gap = await pixel(png, ...GAP);
    // The card is lighter than the panel around it, and nothing red comes from the art.
    expect(cardCorner[0]).toBeGreaterThan(gap[0] + 5);
    expect(await brightest(png, { left: 82, top: 700, width: 186, height: 100 })).toBeGreaterThan(150);
    expect(closeTo(await pixel(png, 175, 650 + 12), RED, 20)).toBe(false);
  });

  it("leaves out the level block when the profile has no level", async () => {
    const withLevel = await renderPlatWallPng(input());
    const without = await renderPlatWallPng(input({ profile: { ...input().profile, level: null } }));
    // The filled part of the level's bar, in silver.
    expect(closeTo(await pixel(withLevel, 2620, 345), [0xc9, 0xd0, 0xda], 8)).toBe(true);
    // Without the level, the counters move to the band's right edge.
    const [plain] = await pixel(withLevel, 2796, 323);
    const [counter] = await pixel(without, 2796, 323);
    expect(counter).toBeGreaterThan(plain + 10);
  });

  it("uses the avatar when it can read it, and survives when it cannot", async () => {
    const withAvatar = await renderPlatWallPng(input({ profile: { ...input().profile, avatarFile: opaque() } }));
    expect(closeTo(await pixel(withAvatar, 182, 283), RED)).toBe(true);
    const unreadable = await renderPlatWallPng(input({ profile: { ...input().profile, avatarFile: broken() } }));
    expect(closeTo(await pixel(unreadable, 182, 283), RED, 40)).toBe(false);
  });

  it("leaves no file behind", async () => {
    const before = (await readdir(dir)).sort();
    await renderPlatWallPng(input({ banner: { file: bannerFile(), posY: 30 } }));
    expect((await readdir(dir)).sort()).toEqual(before);
  });
});
