import { describe, expect, it } from "vitest";
import { EXPORT_COLUMNS, EXPORT_SCALE, cellTextTops, layoutWall } from "./export-layout";

const lines = (n: number, value = 0) => Array<number>(n).fill(value);

describe("layoutWall", () => {
  it("keeps the mockup's scale and columns", () => {
    expect(EXPORT_SCALE).toBe(2);
    expect(EXPORT_COLUMNS).toBe(13);
  });

  it("places 13 columns on 2896 px", () => {
    const { width, height, tiles } = layoutWall({ art: true, rarity: false, nameLines: lines(230) });
    expect(width).toBe(2896);
    expect(Math.abs(height - 4560)).toBeLessThanOrEqual(2);
    expect(tiles).toHaveLength(230);
    expect(tiles[0]).toMatchObject({ x: 82, size: 186 });
    expect(tiles[12].y).toBe(tiles[0].y);
    expect(tiles[13].x).toBe(tiles[0].x);
  });

  it("keeps the panel's padding on both sides of the last column", () => {
    const { tiles } = layoutWall({ art: true, rarity: false, nameLines: lines(13) });
    expect(tiles[12].x + tiles[12].size).toBe(2896 - 82);
  });

  it("starts the wall where the mockup does", () => {
    expect(layoutWall({ art: true, rarity: false, nameLines: lines(1) }).tiles[0].y).toBe(651);
  });

  it("puts 14 px between two rows", () => {
    const { tiles } = layoutWall({ art: true, rarity: false, nameLines: lines(14) });
    expect(tiles[13].y - tiles[0].y).toBe(186 + 28);
  });

  it("sizes a row on its tallest tile", () => {
    const even = layoutWall({ art: true, rarity: false, nameLines: lines(14, 1) });
    const tall = layoutWall({ art: true, rarity: false, nameLines: [1, 3, ...lines(12, 1)] });
    expect(tall.tiles[13].y).toBeGreaterThan(even.tiles[13].y);
    expect(Math.abs(tall.tiles[13].y - even.tiles[13].y - 2 * 2 * 13.125)).toBeLessThanOrEqual(1);
  });

  it("makes room for the rarity", () => {
    const without = layoutWall({ art: true, rarity: false, nameLines: lines(14) });
    const withRarity = layoutWall({ art: true, rarity: true, nameLines: lines(14) });
    expect(withRarity.tiles[13].y - without.tiles[13].y).toBe(2 * (6 + 12));
    expect(withRarity.height).toBeGreaterThan(without.height);
  });

  it("makes text cards 92 px tall when their text is short", () => {
    const { tiles } = layoutWall({ art: false, rarity: true, nameLines: lines(14, 1) });
    expect(tiles[0].height).toBe(184);
    expect(tiles[13].y - tiles[0].y).toBe(184 + 28);
  });

  it("lets a text card grow, and its whole row with it", () => {
    const { tiles } = layoutWall({ art: false, rarity: true, nameLines: [9, ...lines(13, 1)] });
    // padding 8 + 8, rarity 12, gap 5, nine lines of 13.125, in logical pixels.
    expect(tiles[0].height).toBe(Math.round(2 * (16 + 12 + 5 + 9 * 13.125)));
    expect(tiles[1].height).toBe(tiles[0].height);
  });
});

describe("cellTextTops", () => {
  const box = { x: 82, y: 651, size: 186, height: 186 };

  it("stacks the rarity then the name under the art", () => {
    expect(cellTextTops(box, { art: true, rarity: true, lines: 2 })).toEqual({
      rarity: 651 + 186 + 12,
      name: 651 + 186 + 12 + 24 + 12,
    });
  });

  it("moves the name up when there is no rarity", () => {
    expect(cellTextTops(box, { art: true, rarity: false, lines: 2 }).name).toBe(651 + 186 + 12);
  });

  it("centres the text in a card", () => {
    const card = { x: 82, y: 651, size: 186, height: 184 };
    const stack = 24 + 10 + 26.25;
    const top = 651 + (184 - stack) / 2;
    expect(cellTextTops(card, { art: false, rarity: true, lines: 1 })).toEqual({ rarity: top, name: top + 34 });
  });
});
