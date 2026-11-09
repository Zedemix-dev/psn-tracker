import type { TrophyType } from "../db/schema";
import { formatDate, formatRelative, formatTime } from "../lib/format";
import { RARITY_TIERS, rarityTier, type RarityTier } from "../lib/rarity";
import { formatSpan } from "../lib/span";

export const TROPHY_POINTS: Record<TrophyType, number> = { platinum: 300, gold: 90, silver: 30, bronze: 15 };

export type ProgressTrophy = { type: TrophyType; earned: boolean };

export function pointsOf(trophies: ProgressTrophy[]): { total: number; earned: number } {
  let total = 0;
  let earned = 0;
  for (const t of trophies) {
    total += TROPHY_POINTS[t.type];
    if (t.earned) earned += TROPHY_POINTS[t.type];
  }
  return { total, earned };
}

/** PSN-style progress: platinum excluded, floored, at least 1 once any non-platinum point is earned. */
export function groupProgress(trophies: ProgressTrophy[]): number {
  const base = trophies.filter((t) => t.type !== "platinum");
  const { total, earned } = pointsOf(base);
  if (total === 0 || earned === 0) return 0;
  return Math.max(1, Math.floor((earned * 100) / total));
}

export function typeCounts(trophies: ProgressTrophy[]): Record<TrophyType, [earned: number, defined: number]> {
  const counts: Record<TrophyType, [number, number]> = {
    platinum: [0, 0],
    gold: [0, 0],
    silver: [0, 0],
    bronze: [0, 0],
  };
  for (const t of trophies) {
    counts[t.type][1] += 1;
    if (t.earned) counts[t.type][0] += 1;
  }
  return counts;
}

export type RarityStats = { average: number; lowest: number; median: number; highest: number };

export function rarityStats(rates: (number | null)[]): RarityStats | null {
  const v = rates.filter((r): r is number => r != null).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return {
    average: v.reduce((s, r) => s + r, 0) / v.length,
    lowest: v[0],
    median: v.length % 2 === 1 ? v[mid] : (v[mid - 1] + v[mid]) / 2,
    highest: v[v.length - 1],
  };
}

export function rarityBreakdownOf(rates: (number | null)[]): Record<RarityTier, number> {
  const out = Object.fromEntries(RARITY_TIERS.map((t) => [t, 0])) as Record<RarityTier, number>;
  for (const r of rates) if (r != null) out[rarityTier(r)] += 1;
  return out;
}

export type TimelineRow = { label: string; note: string | null; date: string | null; time: string | null };

export function buildTimeline(
  earned: { type: TrophyType; earnedAt: Date }[],
  hasPlatinum: boolean,
  now: Date,
): TimelineRow[] {
  if (earned.length === 0) return [{ label: "No trophy earned yet", note: null, date: null, time: null }];
  const sorted = [...earned].sort((a, b) => a.earnedAt.getTime() - b.earnedAt.getTime());
  const first = sorted[0].earnedAt;
  const last = sorted[sorted.length - 1].earnedAt;
  const rows: TimelineRow[] = [
    { label: "First trophy", note: formatRelative(first, now), date: formatDate(first), time: formatTime(first) },
  ];
  if (hasPlatinum) {
    const plat = sorted.find((t) => t.type === "platinum");
    rows.push(
      plat
        ? {
            label: "Platinum",
            note: formatSpan(first, plat.earnedAt, 3),
            date: formatDate(plat.earnedAt),
            time: formatTime(plat.earnedAt),
          }
        : { label: "Platinum", note: "Not earned yet", date: "—", time: null },
    );
  }
  rows.push(
    { label: "Latest trophy", note: formatRelative(last, now), date: formatDate(last), time: formatTime(last) },
    { label: "Gap", note: formatSpan(first, last), date: null, time: null },
  );
  return rows;
}
