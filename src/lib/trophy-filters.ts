import { and, eq, sql, type SQL } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { titles, trophies } from "@/src/db/schema";
import { RARITY_RANGES } from "@/src/lib/rarity";
import { tierOf, type LogQuery } from "@/src/trophy-log/query";

/** The join of a trophy to its title. */
export const ofTitle = eq(trophies.titleId, titles.npCommunicationId);

/** Platform, rarity and type conditions, shared by the Trophy Log and the Trophy Advisor. */
export function trophyFilters(query: Pick<LogQuery, "platform" | "rarity" | "type">): SQL | undefined {
  const conds: SQL[] = [];
  if (query.platform !== "all") conds.push(sql`${query.platform} = any(${titles.platforms})`);
  if (query.rarity !== "all") {
    // An unknown rate fails both comparisons: it only shows under All rarities.
    const [min, max] = RARITY_RANGES[tierOf(query.rarity)];
    conds.push(sql`${trophies.earnedRate} >= ${min}`);
    if (max !== null) conds.push(sql`${trophies.earnedRate} < ${max}`);
  }
  if (query.type !== "all") conds.push(eq(trophies.type, query.type));
  return and(...conds);
}

export async function countTrophiesWhere(db: Db, where: SQL | undefined): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(trophies)
    .innerJoin(titles, ofTitle)
    .where(where);
  return row.n;
}
