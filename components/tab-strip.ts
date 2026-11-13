export const TAB_FADE_PX = 32;

export type StripView = { scrollLeft: number; clientWidth: number; scrollWidth: number };

const overflows = (v: StripView) => v.scrollWidth > v.clientWidth + 1;

export function edgeFades(v: StripView): { fl: boolean; fr: boolean } {
  if (!overflows(v)) return { fl: false, fr: false };
  const max = v.scrollWidth - v.clientWidth;
  return { fl: v.scrollLeft > 1, fr: v.scrollLeft < max - 1 };
}

/** Scroll offset that centres `item` when it is hidden or under a fade, else null. */
export function scrollToShow(v: StripView, item: { left: number; width: number }): number | null {
  if (!overflows(v)) return null;
  const { fl, fr } = edgeFades(v);
  const from = v.scrollLeft + (fl ? TAB_FADE_PX : 0);
  const to = v.scrollLeft + v.clientWidth - (fr ? TAB_FADE_PX : 0);
  if (item.left >= from && item.left + item.width <= to) return null;
  const max = v.scrollWidth - v.clientWidth;
  return Math.min(max, Math.max(0, Math.round(item.left - (v.clientWidth - item.width) / 2)));
}
