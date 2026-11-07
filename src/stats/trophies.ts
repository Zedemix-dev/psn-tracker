import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { titles, trophies, type TrophyType } from "@/src/db/schema";
import { RARITY_TIERS, rarityTier, type RarityTier } from "@/src/lib/rarity";

export type EarnedTrophy = {
  titleId: string;
  trophyId: number;
  name: string;
  detail: string;
  iconUrl: string | null;
  type: TrophyType;
  earnedAt: Date;
  earnedRate: number | null;
  gameName: string;
};

const selection = {
  titleId: trophies.titleId,
  trophyId: trophies.trophyId,
  name: trophies.name,
  detail: trophies.detail,
  iconUrl: trophies.iconUrl,
  type: trophies.type,
  earnedAt: trophies.earnedAt,
  earnedRate: trophies.earnedRate,
  gameName: titles.name,
};

type Row = {
  titleId: string;
  trophyId: number;
  name: string;
  detail: string | null;
  iconUrl: string;
  type: TrophyType;
  earnedAt: Date | null;
  earnedRate: string | null;
  gameName: string;
};

function toEarned(r: Row): EarnedTrophy {
  return {
    titleId: r.titleId,
    trophyId: r.trophyId,
    name: r.name,
    detail: r.detail ?? "",
    iconUrl: r.iconUrl,
    type: r.type,
    earnedAt: r.earnedAt!,
    earnedRate: r.earnedRate == null ? null : Number(r.earnedRate),
    gameName: r.gameName,
  };
}

/** Earned trophies of visible (non-hidden) titles. */
const earnedVisible = and(eq(trophies.earned, true), isNotNull(trophies.earnedAt), eq(titles.hidden, false));

function baseQuery(db: Db) {
  return db.select(selection).from(trophies).innerJoin(titles, eq(trophies.titleId, titles.npCommunicationId));
}

/** Within the same second the platinum sorts first (the reverse of milestone numbering). */
const platinumFirst = sql`case when ${trophies.type} = 'platinum' then 0 else 1 end`;
const earnedSecond = sql`date_trunc('second', ${trophies.earnedAt})`;

export async function getAllEarned(db: Db): Promise<EarnedTrophy[]> {
  const rows = await baseQuery(db).where(earnedVisible);
  return rows.map(toEarned);
}

export async function getLatestTrophies(db: Db, limit = 20): Promise<EarnedTrophy[]> {
  const rows = await baseQuery(db)
    .where(earnedVisible)
    .orderBy(
      desc(earnedSecond),
      platinumFirst,
      desc(trophies.trophyId),
      sql`${trophies.titleId} collate "C" desc`,
    )
    .limit(limit);
  return rows.map(toEarned);
}

export async function getRarest(db: Db, limit = 5): Promise<EarnedTrophy[]> {
  const rows = await baseQuery(db)
    .where(and(earnedVisible, isNotNull(trophies.earnedRate)))
    .orderBy(asc(trophies.earnedRate), asc(trophies.earnedAt), asc(trophies.trophyId), asc(trophies.titleId))
    .limit(limit);
  return rows.map(toEarned);
}

export async function getRarityBreakdown(db: Db): Promise<Record<RarityTier, number>> {
  const result = Object.fromEntries(RARITY_TIERS.map((t) => [t, 0])) as Record<RarityTier, number>;
  const rows = await db
    .select({ rate: trophies.earnedRate, n: sql<number>`count(*)::int` })
    .from(trophies)
    .innerJoin(titles, eq(trophies.titleId, titles.npCommunicationId))
    .where(and(earnedVisible, isNotNull(trophies.earnedRate)))
    .groupBy(trophies.earnedRate);
  for (const { rate, n } of rows) result[rarityTier(Number(rate))] += n;
  return result;
}
