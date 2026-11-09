export const EXPORT_SCALE = 2;
export const EXPORT_COLUMNS = 13;

/** One cell of the wall: `size` is its width and the side of its art, `height` that of its row. */
export type TileBox = { x: number; y: number; size: number; height: number };

const px = (logical: number) => logical * EXPORT_SCALE;

// All sizes come from the #png block of the validated mockup.
export const WALL_PANEL = { x: px(24), y: px(308.6), width: px(1400), bottomMargin: px(24) };
export const RARITY_HEIGHT = px(12);
export const NAME_LINE_HEIGHT = px(13.125);

const EXPORT_WIDTH = px(1448);
const PANEL_INSET = px(17); // Border + padding.
const COLUMN_GAP = px(13);
const ROW_GAP = px(14);
const TILE = (WALL_PANEL.width - 2 * PANEL_INSET - (EXPORT_COLUMNS - 1) * COLUMN_GAP) / EXPORT_COLUMNS;
const ART_GAP = px(6);
const CARD_GAP = px(5);
const CARD_MIN_HEIGHT = px(92);
const CARD_PADDING_Y = px(8);
const CARD_PADDING_X = px(6);

/** Room for one line of a game's name: the art's width, or a text card's inner width. */
export function nameMaxWidth(art: boolean): number {
  return art ? TILE : TILE - 2 * CARD_PADDING_X;
}

function textStackHeight(gap: number, rarity: boolean, lines: number): number {
  const parts = [rarity ? RARITY_HEIGHT : 0, lines * NAME_LINE_HEIGHT].filter((h) => h > 0);
  return parts.reduce((sum, h) => sum + h, 0) + gap * Math.max(0, parts.length - 1);
}

function cellHeight(art: boolean, rarity: boolean, lines: number): number {
  if (!art) return Math.max(CARD_MIN_HEIGHT, textStackHeight(CARD_GAP, rarity, lines) + 2 * CARD_PADDING_Y);
  const text = textStackHeight(ART_GAP, rarity, lines);
  return TILE + (text > 0 ? ART_GAP + text : 0);
}

/** `nameLines` holds, for each tile, the lines of its name: 0 when names are not shown. */
export function layoutWall(args: { art: boolean; rarity: boolean; nameLines: number[] }): {
  width: number;
  height: number;
  tiles: TileBox[];
} {
  const { art, rarity, nameLines } = args;
  const left = WALL_PANEL.x + PANEL_INSET;
  const tiles: TileBox[] = [];
  let top = WALL_PANEL.y + PANEL_INSET;
  let bottom = top;
  for (let i = 0; i < nameLines.length; i += EXPORT_COLUMNS) {
    const row = nameLines.slice(i, i + EXPORT_COLUMNS);
    const rowHeight = Math.max(...row.map((lines) => cellHeight(art, rarity, lines)));
    const y = Math.round(top);
    const height = Math.round(top + rowHeight) - y;
    row.forEach((_, column) => {
      tiles.push({ x: Math.round(left + column * (TILE + COLUMN_GAP)), y, size: Math.round(TILE), height });
    });
    bottom = top + rowHeight;
    top = bottom + ROW_GAP;
  }
  return { width: EXPORT_WIDTH, height: Math.round(bottom + PANEL_INSET + WALL_PANEL.bottomMargin), tiles };
}

/** Top of the rarity and of the name's first line in a cell. A tile without a rate has no rarity line. */
export function cellTextTops(
  box: TileBox,
  cell: { art: boolean; rarity: boolean; lines: number },
): { rarity: number; name: number } {
  const { art, rarity, lines } = cell;
  const gap = art ? ART_GAP : CARD_GAP;
  const top = art ? box.y + box.size + ART_GAP : box.y + (box.height - textStackHeight(gap, rarity, lines)) / 2;
  return { rarity: top, name: rarity ? top + RARITY_HEIGHT + gap : top };
}
