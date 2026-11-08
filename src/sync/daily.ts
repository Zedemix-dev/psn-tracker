import { and, eq } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { titles, trophies, trophyGroups } from "@/src/db/schema";
import type { AppConfig } from "@/src/lib/config";
import type { PsnGateway } from "@/src/psn/gateway";
import { describeFailure, executeRun, type SyncDeps, type SyncRunResult } from "@/src/sync/run";
import { syncTitle } from "@/src/sync/title";

/**
 * Daily refresh: updates earnedRate / rareCategory of every stored, non-hidden
 * title, and reloads a title whose set of trophy groups (DLC) changed.
 */
export async function runDailyRefresh(
  db: Db,
  gw: PsnGateway,
  cfg: AppConfig,
  now: Date = new Date(),
  deps?: SyncDeps,
): Promise<SyncRunResult> {
  return executeRun(db, gw, cfg, async () => "daily", now, deps, async ({ gw: paced, auth, progress, failures }) => {
    const remoteById = new Map((await paced.getTitles(auth)).map((t) => [t.npCommunicationId, t]));
    const stored = await db
      .select({ id: titles.npCommunicationId, service: titles.npServiceName })
      .from(titles)
      .where(eq(titles.hidden, false));
    await progress.setTotal(stored.length);

    for (const { id, service } of stored) {
      let updated = 0;
      try {
        const ref = { npCommunicationId: id, npServiceName: service as "trophy" | "trophy2" };
        const user = await paced.getUserTrophies(auth, ref);
        const groups = await paced.getGroups(auth, ref);
        const knownRows = await db
          .select({ groupId: trophyGroups.groupId })
          .from(trophyGroups)
          .where(eq(trophyGroups.titleId, id));
        const known = new Set(knownRows.map((r) => r.groupId));
        const sameGroups = groups.length === known.size && groups.every((g) => known.has(g.groupId));
        const remote = remoteById.get(id);
        if (!sameGroups && remote) {
          updated = (await syncTitle(db, paced, auth, remote, now)).trophiesUpdated;
        } else {
          await db.transaction(async (tx) => {
            for (const u of user) {
              await tx
                .update(trophies)
                .set({
                  earnedRate: u.earnedRate == null ? null : u.earnedRate.toFixed(2),
                  rareCategory: u.rareCategory,
                })
                .where(and(eq(trophies.titleId, id), eq(trophies.trophyId, u.trophyId)));
            }
          });
          updated = user.length;
        }
        await db.update(titles).set({ groupsCheckedAt: now }).where(eq(titles.npCommunicationId, id));
      } catch (err) {
        failures.push(describeFailure(id, err));
      }
      await progress.titleDone(updated);
    }
  });
}
