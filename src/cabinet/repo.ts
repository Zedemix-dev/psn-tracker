import { and, asc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { cabinet, titles, trophies } from "@/src/db/schema";
import { toEarned, trophySelection, type EarnedTrophy } from "@/src/stats/trophies";

export const CABINET_SIZE = 10;
export class CabinetValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CabinetValidationError";
  }
}

export type CabinetEntry = { titleId: string; trophyId: number };

const earnedVisible = and(eq(trophies.earned, true), isNotNull(trophies.earnedAt), eq(titles.hidden, false));
const keyOf = (e: CabinetEntry) => `${e.titleId}\u0000${e.trophyId}`;

export async function getCabinet(db: Db): Promise<EarnedTrophy[]> {
  const rows = await db
    .select(trophySelection)
    .from(cabinet)
    .innerJoin(trophies, and(eq(trophies.titleId, cabinet.titleId), eq(trophies.trophyId, cabinet.trophyId)))
    .innerJoin(titles, eq(trophies.titleId, titles.npCommunicationId))
    .where(earnedVisible)
    .orderBy(asc(cabinet.position));
  return rows.map(toEarned);
}

/** Replaces the cabinet with `entries` (positions 1..n) in one transaction. */
export async function saveCabinet(db: Db, entries: CabinetEntry[]): Promise<void> {
  if (entries.length > CABINET_SIZE) throw new CabinetValidationError(`At most ${CABINET_SIZE} trophies fit in the cabinet`);
  const keys = new Set(entries.map(keyOf));
  if (keys.size !== entries.length) throw new CabinetValidationError("The same trophy appears twice");
  if (entries.length > 0) {
    const found = await db
      .select({ titleId: trophies.titleId, trophyId: trophies.trophyId })
      .from(trophies)
      .innerJoin(titles, eq(trophies.titleId, titles.npCommunicationId))
      .where(
        and(
          earnedVisible,
          inArray(trophies.titleId, [...new Set(entries.map((e) => e.titleId))]),
          inArray(trophies.trophyId, [...new Set(entries.map((e) => e.trophyId))]),
        ),
      );
    const earned = new Set(found.map(keyOf));
    if (entries.some((e) => !earned.has(keyOf(e)))) {
      throw new CabinetValidationError("Only earned trophies can be in the cabinet");
    }
  }
  await db.transaction(async (tx) => {
    await tx.delete(cabinet);
    if (entries.length > 0) {
      await tx
        .insert(cabinet)
        .values(entries.map((e, i) => ({ position: i + 1, titleId: e.titleId, trophyId: e.trophyId })));
    }
  });
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

/** Earned trophies of visible titles whose name or game name contains `q`; rarest first. */
export async function searchEarnedTrophies(db: Db, q: string, limit = 20): Promise<EarnedTrophy[]> {
  const term = q.trim().slice(0, 100);
  const pattern = `%${escapeLike(term)}%`;
  const match = term
    ? or(
        sql`${trophies.name} ilike ${pattern} escape '\\'`,
        sql`${titles.name} ilike ${pattern} escape '\\'`,
      )
    : undefined;
  const rows = await db
    .select(trophySelection)
    .from(trophies)
    .innerJoin(titles, eq(trophies.titleId, titles.npCommunicationId))
    .where(and(earnedVisible, match))
    .orderBy(
      sql`${trophies.earnedRate} asc nulls last`,
      asc(trophies.name),
      asc(trophies.titleId),
      asc(trophies.trophyId),
    )
    .limit(limit);
  return rows.map(toEarned);
}
