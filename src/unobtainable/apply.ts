import { and, eq, inArray, or, isNotNull, ne } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { titles, trophies, unobtainableList } from "@/src/db/schema";
import { buildIndex, matchTitle, toTrophyIds } from "./match";

/**
 * Rewrites the unobtainable marks from the stored list, in one transaction:
 * everything marked is cleared, then each recognised game is marked again.
 * A game with no existing marked trophy keeps 0 and null.
 */
export async function applyUnobtainable(db: Db): Promise<void> {
  const [list] = await db.select().from(unobtainableList).where(eq(unobtainableList.id, 1));
  if (!list) return;

  const index = buildIndex(list.entries);
  const allTitles = await db
    .select({ id: titles.npCommunicationId, name: titles.name, platforms: titles.platforms })
    .from(titles);
  const trophyRows = await db.select({ titleId: trophies.titleId, trophyId: trophies.trophyId }).from(trophies);

  const idsByTitle = new Map<string, number[]>();
  for (const row of trophyRows) {
    const ids = idsByTitle.get(row.titleId);
    if (ids) ids.push(row.trophyId);
    else idsByTitle.set(row.titleId, [row.trophyId]);
  }

  const writes: { titleId: string; trophyIds: number[]; note: string | null }[] = [];
  for (const t of allTitles) {
    const match = matchTitle(index, { name: t.name, platforms: t.platforms });
    if (!match) continue;
    const trophyIds = toTrophyIds(match, idsByTitle.get(t.id) ?? []);
    if (trophyIds.length === 0) continue;
    writes.push({ titleId: t.id, trophyIds, note: match.note });
  }

  await db.transaction(async (tx) => {
    await tx.update(trophies).set({ unobtainable: false }).where(eq(trophies.unobtainable, true));
    await tx
      .update(titles)
      .set({ unobtainableCount: 0, unobtainableNote: null })
      .where(or(ne(titles.unobtainableCount, 0), isNotNull(titles.unobtainableNote)));
    for (const w of writes) {
      await tx
        .update(trophies)
        .set({ unobtainable: true })
        .where(and(eq(trophies.titleId, w.titleId), inArray(trophies.trophyId, w.trophyIds)));
      await tx
        .update(titles)
        .set({ unobtainableCount: w.trophyIds.length, unobtainableNote: w.note })
        .where(eq(titles.npCommunicationId, w.titleId));
    }
    await tx.update(unobtainableList).set({ appliedAt: new Date() }).where(eq(unobtainableList.id, 1));
  });
}
