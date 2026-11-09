import { formatHoursTotal, formatInt, formatPercent } from "@/src/lib/format";
import type { ProfileStats } from "@/src/stats/profile-stats";

export type StatTileValue = { label: string; value: string; suffix?: string };

/** The six tiles of the profile, as read on the site and in the Plat Wall PNG. */
export function statTileValues(stats: ProfileStats): StatTileValue[] {
  return [
    { label: "Games completed", value: formatInt(stats.gamesCompleted), suffix: `/ ${formatInt(stats.totalGames)}` },
    { label: "Completion rate", value: formatPercent(stats.completionRate) },
    { label: "Average rarity", value: formatPercent(stats.averageRarity) },
    { label: "Unearned trophies", value: formatInt(stats.unearned) },
    { label: "Trophies per day", value: stats.trophiesPerDay.toFixed(2) },
    { label: "Hours played", value: formatHoursTotal(stats.hoursSeconds) },
  ];
}

const TROPHY_TYPES = [
  { type: "platinum", label: "Platinum" },
  { type: "gold", label: "Gold" },
  { type: "silver", label: "Silver" },
  { type: "bronze", label: "Bronze" },
] as const;

export type TrophyType = (typeof TROPHY_TYPES)[number]["type"];
export type TrophyCounts = Record<TrophyType, number>;
export type ProfileCounter = { type: TrophyType | null; label: string; value: string };

/** The counters of the profile band: the total, then one per trophy type. */
export function profileCounterValues(counts: TrophyCounts): ProfileCounter[] {
  const total = TROPHY_TYPES.reduce((sum, t) => sum + counts[t.type], 0);
  return [
    { type: null, label: "Trophies", value: formatInt(total) },
    ...TROPHY_TYPES.map((t) => ({ ...t, value: formatInt(counts[t.type]) })),
  ];
}
