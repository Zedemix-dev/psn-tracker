import { eq, sql } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { playedGames, titles, trophyGroups } from "@/src/db/schema";
import type { AppConfig } from "@/src/lib/config";
import type { PsnGateway } from "@/src/psn/gateway";
import { syncCatalog } from "@/src/sync/catalog";
import { cacheImages } from "@/src/sync/image-cache";
import { describeFailure, executeRun, type SyncDeps, type SyncRunResult } from "@/src/sync/run";
import { syncTitle } from "@/src/sync/title";
import { refreshUserState } from "@/src/sync/user-state";

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
    // Games recorded as "no trophy list" are looked up again by the next sync (a list may have appeared).
    await db.update(playedGames).set({ npCommunicationIds: null }).where(sql`${playedGames.npCommunicationIds} = '{}'`);
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
          updated = await refreshUserState(db, paced, auth, ref);
        }
        await db.update(titles).set({ groupsCheckedAt: now }).where(eq(titles.npCommunicationId, id));
      } catch (err) {
        failures.push(describeFailure(id, err));
      }
      await progress.titleDone(updated);
    }
    await syncCatalog(db, paced, auth, "all", now);
    // A reloaded title may bring new images. Never pruned here: only a clean sync cleans up.
    const img = await cacheImages(db, cfg.mediaDir, deps?.fetchImpl);
    console.log(
      `[worker] images: ${img.downloaded} downloaded, ${img.failed} failed, ${img.thumbs} thumbnails, ${img.tiles} tile colours`,
    );
  });
}
