import path from "node:path";
import type { OverlayOptions } from "sharp";
import { formatPercent } from "@/src/lib/format";
import {
  EXPORT_SCALE,
  NAME_LINE_HEIGHT,
  RARITY_HEIGHT,
  WALL_PANEL,
  cellTextTops,
  layoutWall,
  nameMaxWidth,
  type TileBox,
} from "@/src/plat-wall/export-layout";
import type { PlatShow } from "@/src/plat-wall/query";
import { loadTextEngine, type TextEngine, type TextStyle } from "@/src/plat-wall/text";
import type { ProfileStats } from "@/src/stats/profile-stats";
import {
  profileCounterValues,
  statTileValues,
  type TrophyCounts,
  type TrophyType,
} from "@/src/stats/stat-tile-values";

export type ExportTile = { file: string | null; game: string; rate: number | null };
export type ExportInput = {
  profile: {
    onlineId: string;
    avatarFile: string | null;
    level: number | null;
    levelProgress: number;
    tier: number;
    platinum: number;
    gold: number;
    silver: number;
    bronze: number;
  };
  stats: ProfileStats;
  banner: { file: string; posY: number } | null;
  tiles: ExportTile[];
  show: PlatShow[];
};

type Sharp = (typeof import("sharp"))["default"];
type Box = { x: number; y: number; width: number; height: number };
type Fill = { colour: string; opacity: number };

/** Sizes below are the mockup's logical pixels: `p` turns them into real ones. */
const p = (logical: number) => logical * EXPORT_SCALE;

const BACKGROUND = "#0F1631";
const TEXT = "#F3F5FB";
const MUTED = "#A9B3CB";
const WHITE = "#FFFFFF";
const SILVER = "#C9D0DA";
const COUNTER_COLOUR: Record<TrophyType, string> = {
  platinum: "#D3E2FF",
  gold: "#F2C462",
  silver: SILVER,
  bronze: "#DE9563",
};

const MAX_NAME_LINES = 3;
const NAME_STYLE: TextStyle = { size: p(10.5), weight: 400 };
const RARITY_STYLE: TextStyle = { size: p(12), weight: 600, tabular: true };

const icon = (name: string) => path.join(process.cwd(), "public", "icons", name);

// Centring a line of text: CSS centres Sora's content box, .97 em above the baseline and .29 em below.
const baseline = (middle: number, size: number) => middle + size * 0.34;

function line(
  engine: TextEngine,
  text: string,
  style: TextStyle,
  at: { x: number; middle: number; anchor?: "middle"; fill: string },
): string {
  return engine.path(text, style, { x: at.x, y: baseline(at.middle, style.size), anchor: at.anchor, fill: at.fill });
}

/** A rectangle snapped to whole pixels, as a browser does. */
function snap({ x, y, width, height }: Box): Box {
  const left = Math.round(x);
  const top = Math.round(y);
  return { x: left, y: top, width: Math.round(x + width) - left, height: Math.round(y + height) - top };
}

const rectAttrs = (r: Box) => `x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}"`;

function rect(box: Box, radius: number, fill: Fill): string {
  return `<rect ${rectAttrs(snap(box))} rx="${radius}" fill="${fill.colour}" fill-opacity="${fill.opacity}"/>`;
}

/** The site's `.glass` panel, without its blur: a fill, then a 1 px line inside its edge. */
function panel(box: Box, radius: number, fill: Fill): string {
  const r = snap(box);
  const inset = p(1) / 2;
  const edge = { x: r.x + inset, y: r.y + inset, width: r.width - p(1), height: r.height - p(1) };
  return (
    rect(box, radius, fill) +
    `<rect ${rectAttrs(edge)} rx="${radius - inset}" fill="none" stroke="${WHITE}" stroke-opacity=".13" stroke-width="${p(1)}"/>`
  );
}

const svgDocument = (width: number, height: number, body: string) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${body}</svg>`);

const scaled = ({ x, y, width, height }: Box): Box => ({ x: p(x), y: p(y), width: p(width), height: p(height) });

const BAND = { x: 24, y: 118, width: 1400, height: 87.6 };
const BAND_MIDDLE = BAND.y + BAND.height / 2;
const BAND_FILL: Fill = { colour: "#141828", opacity: 0.55 };
const AVATAR = { x: 45, y: 95.8, size: 92, border: 3 };
const COUNTERS = { right: 1202, rightWithoutLevel: 1403, gap: 6, top: 134.6, height: 54.4, minWidth: 64, padding: 8 };
const COUNTER_FILL: Fill = { colour: WHITE, opacity: 0.12 };
// The value and the label are centred together: 17 + 4 + 15.4 in the 54.4 of the counter.
const COUNTER_VALUE_TOP = COUNTERS.top + 9;
const COUNTER_LABEL_TOP = COUNTER_VALUE_TOP + 17 + 4;
const COUNTER_ICON = { size: 11, gap: 3 };
const LEVEL = {
  dividerX: 1224,
  top: 131,
  height: 61.6,
  icon: { x: 1245, y: 139.8, size: 44 },
  textX: 1299,
  bar: { y: 171.2, width: 104, height: 3 },
};
const STAT = { x: 24, y: 217.6, width: 225, height: 77, gap: 10, inset: 17 };
const STAT_FILL: Fill = { colour: "#141828", opacity: 0.45 };
const WALL_FILL: Fill = { colour: "#0F1222", opacity: 0.5 };
const CARD_FILL: Fill = { colour: WHITE, opacity: 0.07 };

type IconSpot = { type: TrophyType; left: number; top: number };

function counters(engine: TextEngine, counts: TrophyCounts, right: number): { svg: string; icons: IconSpot[] } {
  const value: TextStyle = { size: p(17), weight: 700, tabular: true };
  const label: TextStyle = { size: p(11), weight: 400 };
  const iconWidth = p(COUNTER_ICON.size + COUNTER_ICON.gap);
  let svg = "";
  const icons: IconSpot[] = [];
  let edge = p(right);
  for (const counter of profileCounterValues(counts).reverse()) {
    const labelRow = engine.measure(counter.label, label) + (counter.type ? iconWidth : 0);
    const content = Math.max(engine.measure(counter.value, value), labelRow);
    const width = Math.max(p(COUNTERS.minWidth), content + p(2 * COUNTERS.padding));
    const x = edge - width;
    const centre = x + width / 2;
    svg += rect({ x, y: p(COUNTERS.top), width, height: p(COUNTERS.height) }, p(10), COUNTER_FILL);
    svg += line(engine, counter.value, value, {
      x: centre,
      middle: p(COUNTER_VALUE_TOP + 17 / 2),
      anchor: "middle",
      fill: counter.type ? COUNTER_COLOUR[counter.type] : TEXT,
    });
    const rowLeft = centre - labelRow / 2;
    if (counter.type) {
      const iconTop = p(COUNTER_LABEL_TOP + (15.4 - COUNTER_ICON.size) / 2);
      icons.push({ type: counter.type, left: Math.round(rowLeft), top: Math.round(iconTop) });
    }
    svg += line(engine, counter.label, label, {
      x: rowLeft + (counter.type ? iconWidth : 0),
      middle: p(COUNTER_LABEL_TOP + 15.4 / 2),
      fill: MUTED,
    });
    edge = x - p(COUNTERS.gap);
  }
  return { svg, icons };
}

function levelBlock(engine: TextEngine, level: number, progress: number): string {
  const x = p(LEVEL.textX);
  const bar = snap({ x, y: p(LEVEL.bar.y), width: p(LEVEL.bar.width), height: p(LEVEL.bar.height) });
  const filled = { ...bar, width: (bar.width * Math.min(100, Math.max(0, progress))) / 100 };
  const divider = { x: LEVEL.dividerX, y: LEVEL.top, width: 1, height: LEVEL.height };
  return [
    rect(scaled(divider), 0, { colour: WHITE, opacity: 0.13 }),
    line(engine, "PSN level", { size: p(11), weight: 500 }, { x, middle: p(LEVEL.top + 13.2 / 2), fill: MUTED }),
    line(engine, String(level), { size: p(20), weight: 700 }, { x, middle: p(LEVEL.top + 13.2 + 2 + 10), fill: TEXT }),
    `<clipPath id="level-bar"><rect ${rectAttrs(bar)} rx="${bar.height / 2}"/></clipPath>`,
    rect(bar, bar.height / 2, COUNTER_FILL),
    `<g clip-path="url(#level-bar)">${rect(filled, 0, { colour: SILVER, opacity: 1 })}</g>`,
    line(engine, `${progress}% to level ${level + 1}`, { size: p(11), weight: 400 }, {
      x,
      middle: p(LEVEL.bar.y + LEVEL.bar.height + 3 + 15.4 / 2),
      fill: MUTED,
    }),
  ].join("");
}

function profileBand(engine: TextEngine, profile: ExportInput["profile"]): { svg: string; icons: IconSpot[] } {
  const radius = p(AVATAR.size / 2);
  const avatarX = p(AVATAR.x) + radius;
  const avatarY = Math.round(p(AVATAR.y)) + radius;
  const right = profile.level === null ? COUNTERS.rightWithoutLevel : COUNTERS.right;
  const counterRow = counters(engine, profile, right);
  const svg = [
    panel(scaled(BAND), p(14), BAND_FILL),
    `<circle cx="${avatarX}" cy="${avatarY}" r="${radius}" fill="${WHITE}" fill-opacity="${COUNTER_FILL.opacity}"/>`,
    line(engine, profile.onlineId, { size: p(22), weight: 700 }, { x: p(159), middle: p(BAND_MIDDLE), fill: TEXT }),
    counterRow.svg,
    profile.level === null ? "" : levelBlock(engine, profile.level, profile.levelProgress),
  ].join("");
  return { svg, icons: counterRow.icons };
}

function statTiles(engine: TextEngine, stats: ProfileStats): string {
  const label: TextStyle = { size: p(12), weight: 400 };
  const value: TextStyle = { size: p(28), weight: 700, tabular: true };
  const suffix: TextStyle = { size: p(18), weight: 600, tabular: true };
  const labelMiddle = p(STAT.y + 13 + 16.8 / 2);
  const valueMiddle = p(STAT.y + 13 + 16.8 + 2 + 32.2 / 2);
  return statTileValues(stats)
    .map((tile, i) => {
      const left = STAT.x + i * (STAT.width + STAT.gap);
      const x = p(left + STAT.inset);
      return [
        panel(scaled({ x: left, y: STAT.y, width: STAT.width, height: STAT.height }), p(12), STAT_FILL),
        line(engine, tile.label, label, { x, middle: labelMiddle, fill: MUTED }),
        line(engine, tile.value, value, { x, middle: valueMiddle, fill: TEXT }),
        // The suffix shares the value's baseline and follows it after a space of the value's size.
        tile.suffix
          ? engine.path(tile.suffix, suffix, {
              x: x + engine.measure(`${tile.value} `, value),
              y: baseline(valueMiddle, value.size),
              fill: MUTED,
            })
          : "",
      ].join("");
    })
    .join("");
}

function wallCell(
  engine: TextEngine,
  box: TileBox,
  tile: ExportTile,
  show: { art: boolean; rarity: boolean },
  nameLines: string[],
): string {
  const rate = show.rarity ? tile.rate : null;
  const tops = cellTextTops(box, { art: show.art, rarity: rate !== null, lines: nameLines.length });
  const x = box.x + box.size / 2;
  const card = show.art ? "" : rect({ x: box.x, y: box.y, width: box.size, height: box.height }, p(12), CARD_FILL);
  const rarity =
    rate === null
      ? ""
      : line(engine, formatPercent(rate), RARITY_STYLE, {
          x,
          middle: tops.rarity + RARITY_HEIGHT / 2,
          anchor: "middle",
          fill: TEXT,
        });
  const name = nameLines
    .map((text, i) =>
      line(engine, text, NAME_STYLE, {
        x,
        middle: tops.name + NAME_LINE_HEIGHT * (i + 0.5),
        anchor: "middle",
        fill: MUTED,
      }),
    )
    .join("");
  return card + rarity + name;
}

function fadeMask(width: number, height: number): Buffer {
  const stops = `<stop offset=".6" stop-color="${WHITE}"/><stop offset="1" stop-color="${WHITE}" stop-opacity="0"/>`;
  const gradient = `<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>`;
  return svgDocument(width, height, `<defs>${gradient}</defs><rect width="${width}" height="${height}" fill="url(#fade)"/>`);
}

// CSS brightness(.4) saturate(1.25), as a multiplication then CSS's own matrix. sharp's modulate
// works in LCH: with these values its colours are much stronger than the mockup's.
const BRIGHTNESS = 0.4;
const SATURATE: [[number, number, number], [number, number, number], [number, number, number]] = [
  [0.213 + 0.787 * 1.25, 0.715 - 0.715 * 1.25, 0.072 - 0.072 * 1.25],
  [0.213 - 0.213 * 1.25, 0.715 + 0.285 * 1.25, 0.072 - 0.072 * 1.25],
  [0.213 - 0.213 * 1.25, 0.715 - 0.715 * 1.25, 0.072 + 0.928 * 1.25],
];

/** The whole-image backdrop: blurred at 1/8 size, which is faster and looks the same. */
async function blurredBanner(sharp: Sharp, file: string, width: number, height: number): Promise<Buffer> {
  const bleed = p(60);
  const full = { width: width + 2 * bleed, height: height + 2 * bleed };
  const small = await sharp(file)
    .autoOrient()
    // Without this, the blur leaves the alpha at 249 and the plain background shows through.
    .flatten({ background: BACKGROUND })
    .resize(Math.round(full.width / 8), Math.round(full.height / 8))
    .blur(11)
    .png({ compressionLevel: 1 })
    .toBuffer();
  return sharp(small)
    .resize(full)
    .extract({ left: bleed, top: bleed, width, height })
    .linear(BRIGHTNESS, 0)
    .recomb(SATURATE)
    .png({ compressionLevel: 1 })
    .toBuffer();
}

/** The sharp banner, cropped like CSS `center <posY>% / cover`, fading out from 60 % of its height. */
async function sharpBanner(sharp: Sharp, file: string, posY: number, width: number): Promise<Buffer> {
  const height = p(190);
  const { autoOrient: source } = await sharp(file).metadata();
  const scale = Math.max(width / source.width, height / source.height);
  const cover = {
    width: Math.max(width, Math.round(source.width * scale)),
    height: Math.max(height, Math.round(source.height * scale)),
  };
  const y = Math.min(100, Math.max(0, posY)) / 100;
  return sharp(file)
    .autoOrient()
    .resize({ ...cover, fit: "fill" })
    .extract({
      left: Math.round((cover.width - width) / 2),
      top: Math.round((cover.height - height) * y),
      width,
      height,
    })
    .composite([{ input: fadeMask(width, height), blend: "dest-in" }])
    .png({ compressionLevel: 1 })
    .toBuffer();
}

/** An unreadable banner is the same as no banner: the export still works. */
async function bannerLayers(
  sharp: Sharp,
  banner: ExportInput["banner"],
  width: number,
  height: number,
): Promise<OverlayOptions[]> {
  if (!banner) return [];
  try {
    const [backdrop, hero] = await Promise.all([
      blurredBanner(sharp, banner.file, width, height),
      sharpBanner(sharp, banner.file, banner.posY, width),
    ]);
    return [
      { input: backdrop, left: 0, top: 0 },
      { input: hero, left: 0, top: 0 },
    ];
  } catch {
    return [];
  }
}

async function avatarLayers(sharp: Sharp, file: string | null): Promise<OverlayOptions[]> {
  const size = p(AVATAR.size);
  const border = p(AVATAR.border);
  const left = p(AVATAR.x);
  const top = Math.round(p(AVATAR.y));
  const ring = svgDocument(
    size,
    size,
    `<circle cx="${size / 2}" cy="${size / 2}" r="${(size - border) / 2}" fill="none" stroke="${WHITE}" stroke-opacity=".9" stroke-width="${border}"/>`,
  );
  const layers: OverlayOptions[] = [];
  if (file) {
    // One pixel wider than the opening of the ring, which is drawn over it: no seam between them.
    const disc = size - 2 * border + 2;
    const mask = svgDocument(disc, disc, `<circle cx="${disc / 2}" cy="${disc / 2}" r="${disc / 2}" fill="${WHITE}"/>`);
    try {
      const input = await sharp(file)
        .autoOrient()
        .resize(disc, disc)
        .composite([{ input: mask, blend: "dest-in" }])
        .png({ compressionLevel: 1 })
        .toBuffer();
      layers.push({ input, left: left + border - 1, top: top + border - 1 });
    } catch {
      // Keep the empty circle, as on the site when the image does not load.
    }
  }
  layers.push({ input: ring, left, top });
  return layers;
}

async function counterIconLayers(sharp: Sharp, spots: IconSpot[]): Promise<OverlayOptions[]> {
  const size = p(COUNTER_ICON.size);
  return Promise.all(
    spots.map(async (spot) => ({
      input: await sharp(icon(`40-${spot.type}.png`)).resize(size, size).png({ compressionLevel: 1 }).toBuffer(),
      left: spot.left,
      top: spot.top,
    })),
  );
}

/** Row `tier` of the sprite, counted from the top, as in components/levelSprite.ts. */
async function levelIconLayer(sharp: Sharp, tier: number): Promise<OverlayOptions> {
  const file = icon("level-sprite.png");
  const { width, height } = await sharp(file).metadata();
  const rowHeight = Math.floor(height / 10);
  const row = Math.min(10, Math.max(1, Math.round(tier))) - 1;
  const size = p(LEVEL.icon.size);
  return {
    input: await sharp(file)
      .extract({ left: 0, top: row * rowHeight, width, height: rowHeight })
      .resize(size, size, { fit: "fill" })
      .png({ compressionLevel: 1 })
      .toBuffer(),
    left: p(LEVEL.icon.x),
    top: Math.round(p(LEVEL.icon.y)),
  };
}

async function thumbLayer(sharp: Sharp, file: string | null, box: TileBox, mask: Buffer): Promise<OverlayOptions> {
  const placeholder = icon("placeholder.svg");
  const draw = (source: string) =>
    sharp(source)
      .resize(box.size, box.size)
      .composite([{ input: mask, blend: "dest-in" }])
      .png({ compressionLevel: 1 })
      .toBuffer();
  const input = await (file === null ? draw(placeholder) : draw(file).catch(() => draw(placeholder)));
  return { input, left: box.x, top: box.y };
}

export async function renderPlatWallPng(input: ExportInput): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  const engine = await loadTextEngine();
  const show = { art: input.show.includes("art"), rarity: input.show.includes("rarity") };
  const names = input.tiles.map((tile) =>
    input.show.includes("name") ? engine.wrap(tile.game, NAME_STYLE, nameMaxWidth(show.art), MAX_NAME_LINES) : [],
  );
  const { width, height, tiles: boxes } = layoutWall({ ...show, nameLines: names.map((lines) => lines.length) });

  const band = profileBand(engine, input.profile);
  const wallBox = { ...WALL_PANEL, height: height - WALL_PANEL.bottomMargin - WALL_PANEL.y };
  const cells = input.tiles.map((tile, i) => wallCell(engine, boxes[i], tile, show, names[i])).join("");
  const vector = svgDocument(
    width,
    height,
    band.svg + statTiles(engine, input.stats) + panel(wallBox, p(14), WALL_FILL) + cells,
  );

  const size = boxes[0]?.size ?? 0;
  const tileMask = svgDocument(size, size, `<rect width="${size}" height="${size}" rx="${p(12)}" fill="${WHITE}"/>`);
  const [backgrounds, avatar, counterIcons, levelIcon, thumbs] = await Promise.all([
    bannerLayers(sharp, input.banner, width, height),
    avatarLayers(sharp, input.profile.avatarFile),
    counterIconLayers(sharp, band.icons),
    input.profile.level === null ? [] : levelIconLayer(sharp, input.profile.tier).then((layer) => [layer]),
    show.art ? Promise.all(input.tiles.map((tile, i) => thumbLayer(sharp, tile.file, boxes[i], tileMask))) : [],
  ]);

  return sharp({ create: { width, height, channels: 4, background: BACKGROUND } })
    .composite([
      ...backgrounds,
      { input: vector, left: 0, top: 0 },
      ...avatar,
      ...counterIcons,
      ...levelIcon,
      ...thumbs,
    ])
    .png({ compressionLevel: 6 })
    .toBuffer();
}
