import { and, eq, isNotNull, ne, sql } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { titles, trophies } from "@/src/db/schema";

export type ProfileStats = {
  gamesCompleted: number;
  totalGames: number;
  completionRate: number;
  averageRarity: number;
  unearned: number;
  trophiesPerDay: number;
  hoursSeconds: number;
};

const DAY_MS = 86_400_000;
const round2 = (n: number) => Math.round(n * 100) / 100;

export async function getProfileStats(
  db: Db,
  opts: { hideZero: boolean; now?: Date },
): Promise<ProfileStats> {
  const now = opts.now ?? new Date();
  const included = opts.hideZero
    ? and(eq(titles.hidden, false), ne(titles.progress, 0))
    : eq(titles.hidden, false);

  const earnedCount = sql`${titles.earnedPlatinum} + ${titles.earnedGold} + ${titles.earnedSilver} + ${titles.earnedBronze}`;
  const definedCount = sql`${titles.definedPlatinum} + ${titles.definedGold} + ${titles.definedSilver} + ${titles.definedBronze}`;

  const [agg] = await db
    .select({
      totalGames: sql<number>`count(*)::int`,
      completed: sql<number>`(count(*) filter (where ${titles.progress} = 100))::int`,
      earned: sql<number>`coalesce(sum(${earnedCount}), 0)::int`,
      defined: sql<number>`coalesce(sum(${definedCount}), 0)::int`,
      playSeconds: sql<number>`coalesce(sum(${titles.playSeconds}), 0)::int`,
    })
    .from(titles)
    .where(included);

  const [tro] = await db
    .select({
      avgRate: sql<string | null>`avg(${trophies.earnedRate}) filter (where ${isNotNull(trophies.earnedRate)})`,
      oldest: sql<string | null>`min(${trophies.earnedAt})`,
    })
    .from(trophies)
    .innerJoin(titles, eq(trophies.titleId, titles.npCommunicationId))
    .where(and(included, eq(trophies.earned, true), isNotNull(trophies.earnedAt)));

  const days = tro.oldest == null ? null : Math.max(1, (now.getTime() - new Date(tro.oldest).getTime()) / DAY_MS);

  return {
    gamesCompleted: agg.completed,
    totalGames: agg.totalGames,
    completionRate: agg.defined === 0 ? 0 : round2((agg.earned / agg.defined) * 100),
    averageRarity: tro.avgRate == null ? 0 : round2(Number(tro.avgRate)),
    unearned: agg.defined - agg.earned,
    trophiesPerDay: days == null ? 0 : round2(agg.earned / days),
    hoursSeconds: agg.playSeconds,
  };
}
