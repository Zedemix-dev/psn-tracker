/** First line of the tooltip and banner: how many trophies are unobtainable. */
export function unobtainableLabel(count: number, total: number): string {
  if (count === 1) return "1 unobtainable trophy";
  if (count === total) return `All ${count} trophies are unobtainable`;
  return `${count} unobtainable trophies`;
}

/** Suffix saying where the user stands: what they are still missing. */
export function unobtainableSituation(count: number, missing: number): string {
  if (missing > 0) return `, ${missing} you don't have`;
  return count === 1 ? ", you have it" : ", you have them all";
}
