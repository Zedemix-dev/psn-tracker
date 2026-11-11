import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { trophies } from "@/src/db/schema";
import type { PsnAuth, PsnGateway } from "@/src/psn/gateway";
import type { TitleRef } from "@/src/psn/types";

/**
 * Rereads the user state of one title and updates, for each stored trophy,
 * earnedRate, rareCategory, progress and progressedAt. Never touches earned or
 * earnedAt. Returns the number of trophies read.
 */
export async function refreshUserState(db: Db, gw: PsnGateway, auth: PsnAuth, ref: TitleRef): Promise<number> {
  const user = await gw.getUserTrophies(auth, ref);
  await db.transaction(async (tx) => {
    for (const u of user) {
      await tx
        .update(trophies)
        .set({
          earnedRate: u.earnedRate == null ? null : u.earnedRate.toFixed(2),
          // An empty category from PSN never replaces a known one; a real value, 0 included, does.
          rareCategory: sql`coalesce(${u.rareCategory}::integer, ${trophies.rareCategory})`,
          progress: u.progress,
          progressedAt: u.progressedAt,
        })
        .where(and(eq(trophies.titleId, ref.npCommunicationId), eq(trophies.trophyId, u.trophyId)));
    }
  });
  return user.length;
}
