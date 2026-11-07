export type FitOptions = { icon: number; gap: number; card: number; narrow: boolean };

/**
 * How many carousel items fit in `width`, flush with both edges.
 * Wide: the detail card plus N icons on one row. Narrow: the card has its own row,
 * icons fill the row below.
 */
export function fitCount(width: number, opts: FitOptions, available: number): number {
  const { icon, gap, card, narrow } = opts;
  const n = narrow ? 1 + Math.floor((width + gap) / (icon + gap)) : 1 + Math.floor((width - card) / (icon + gap));
  return Math.max(1, Math.min(available, n));
}
