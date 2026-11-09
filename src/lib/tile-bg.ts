/** A pixel counts as opaque from this alpha (0-255). */
const OPAQUE = 250;
/** An edge is one colour when no channel strays further than this from the edge's mean. */
const TOLERANCE = 16;

type Rgb = [number, number, number];

function hex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Mean colour of the pixels at `offsets` (RGBA byte offsets), or null if one is see-through or off-colour. */
function uniformColour(data: ArrayLike<number>, offsets: number[]): Rgb | null {
  const sum = [0, 0, 0];
  for (const o of offsets) {
    if (data[o + 3] < OPAQUE) return null;
    for (let c = 0; c < 3; c++) sum[c] += data[o + c];
  }
  const mean = sum.map((s) => Math.round(s / offsets.length)) as Rgb;
  for (const o of offsets) {
    for (let c = 0; c < 3; c++) if (Math.abs(data[o + c] - mean[c]) > TOLERANCE) return null;
  }
  return mean;
}

/**
 * CSS background for the square tile behind a contained, non-square image (spec 8.9):
 * the colour of its two edges facing the bands (top/bottom rows when wider than tall,
 * left/right columns when taller than wide), so the image and its bands read as one square.
 * Null when there are no bands (square or empty image) or an edge is not one opaque colour.
 * `data` is RGBA, 4 bytes per pixel, row by row.
 */
export function edgeBackground(data: ArrayLike<number>, width: number, height: number): string | null {
  if (width <= 0 || height <= 0 || width === height) return null;
  const at = (x: number, y: number) => (y * width + x) * 4;
  const wide = width > height;
  const line = (i: number) =>
    wide
      ? Array.from({ length: width }, (_, x) => at(x, i))
      : Array.from({ length: height }, (_, y) => at(i, y));
  const first = uniformColour(data, line(0));
  const last = uniformColour(data, line((wide ? height : width) - 1));
  if (!first || !last) return null;
  const [a, b] = [hex(first), hex(last)];
  if (a === b) return a;
  return wide ? `linear-gradient(${a} 50%, ${b} 50%)` : `linear-gradient(to right, ${a} 50%, ${b} 50%)`;
}
