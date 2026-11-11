import { compareEarnedOrder } from "@/src/lib/earned-order";
import { TROPHY_POINTS } from "@/src/games/detail-stats";
import type { EarnedTrophy } from "./trophies";

export const MAX_LEVEL = 999;

/** Spec 18.10: points to go from level n to n + 1, by band of n (first level of the band, cost). */
const BANDS: ReadonlyArray<readonly [number, number]> = [
  [1, 60], [100, 90], [200, 450], [300, 900], [400, 1350], [500, 1800], [600, 2250], [700, 2700], [800, 3150], [900, 3600],
];

/** Total points needed to reach `level` (1..999); level 1 is 0. */
export function pointsForLevel(level: number): number {
  let points = 0;
  for (let i = 0; i < BANDS.length; i++) {
    const [from, cost] = BANDS[i];
    const to = Math.min(level, BANDS[i + 1]?.[0] ?? MAX_LEVEL);
    if (to > from) points += (to - from) * cost;
  }
  return points;
}

export type LevelCrossing = { level: number; trophy: EarnedTrophy };

/** One entry per level multiple of 10 that was reached, oldest first. Sorts a copy with compareEarnedOrder. */
export function levelCrossings(trophies: EarnedTrophy[]): LevelCrossing[] {
  const sorted = [...trophies].sort((a, b) =>
    compareEarnedOrder(
      { earnedAtMs: a.earnedAt.getTime(), type: a.type, trophyId: a.trophyId, titleId: a.titleId },
      { earnedAtMs: b.earnedAt.getTime(), type: b.type, trophyId: b.trophyId, titleId: b.titleId },
    ),
  );
  const out: LevelCrossing[] = [];
  let level = 10;
  let total = 0;
  for (const trophy of sorted) {
    total += TROPHY_POINTS[trophy.type];
    while (level <= MAX_LEVEL && total >= pointsForLevel(level)) {
      out.push({ level, trophy });
      level += 10;
    }
  }
  return out;
}
