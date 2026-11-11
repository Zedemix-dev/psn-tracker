/** Pure drawing helpers for the Stats charts (ported from the validated mockup). */

export function niceScale(max: number, ticks: number): { step: number; max: number } {
  const raw = Math.max(max, 1) / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  return { step, max: Math.max(Math.ceil(max / step), 1) * step };
}

/** Fritsch-Carlson monotone cubic path: never overshoots the data. */
export function monotonePath(points: [number, number][]): string {
  const n = points.length;
  if (n === 0) return "";
  if (n === 1) return `M${points[0][0]},${points[0][1]}`;
  const dx: number[] = [];
  const m: number[] = [];
  const t: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = points[i + 1][0] - points[i][0];
    m[i] = dx[i] === 0 ? 0 : (points[i + 1][1] - points[i][1]) / dx[i];
  }
  t[0] = m[0];
  t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) {
    t[i] =
      m[i - 1] * m[i] <= 0
        ? 0
        : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
  }
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${points[i][0] + h},${points[i][1] + t[i] * h} ${points[i + 1][0] - h},${points[i + 1][1] - t[i + 1] * h} ${points[i + 1][0]},${points[i + 1][1]}`;
  }
  return d;
}

export const formatInt = (v: number): string => Math.round(v).toLocaleString("en-US");

export function compactTick(v: number): string {
  return v >= 10000 ? `${v / 1000}K` : formatInt(v);
}

/** Tooltip corner: above and right of the pointer, flipped left / below to stay on screen. */
export function tipPosition(
  pointer: { x: number; y: number },
  size: { w: number; h: number },
  viewport: { w: number; h: number },
): { left: number; top: number } {
  let left = pointer.x + 14;
  let top = pointer.y - size.h - 10;
  if (left + size.w > viewport.w - 8) left = pointer.x - size.w - 14;
  if (top < 8) top = pointer.y + 16;
  left = Math.min(Math.max(left, 8), viewport.w - size.w - 8);
  top = Math.min(top, viewport.h - size.h - 8);
  return { left, top };
}
