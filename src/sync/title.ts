import { and, eq, notInArray, sql } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { titles, trophies, trophyGroups } from "@/src/db/schema";
import type { PsnAuth, PsnGateway } from "@/src/psn/gateway";
import type { RemoteTitle } from "@/src/psn/types";

type Writer = Pick<Db, "insert">;

const sqlExcluded = (column: string) => sql.raw(`excluded."${column}"`);

function titleColumns(remote: RemoteTitle) {
  return {
    npServiceName: remote.npServiceName,
    name: remote.name,
    iconUrl: remote.iconUrl,
    platforms: remote.platforms,
    trophySetVersion: remote.trophySetVersion,
    hasTrophyGroups: remote.hasTrophyGroups,
    definedPlatinum: remote.defined.platinum,
    definedGold: remote.defined.gold,
    definedSilver: remote.defined.silver,
    definedBronze: remote.defined.bronze,
    earnedPlatinum: remote.earned.platinum,
    earnedGold: remote.earned.gold,
    earnedSilver: remote.earned.silver,
    earnedBronze: remote.earned.bronze,
    progress: remote.progress,
    hidden: remote.hidden,
  };
}

/**
 * Upserts the title-level columns coming from PSN. Never touches coverUrl,
 * play-time columns, syncedAt or groupsCheckedAt.
 */
export async function upsertTitleRow(db: Writer, remote: RemoteTitle, _now: Date): Promise<void> {
  const cols = titleColumns(remote);
  await db
    .insert(titles)
    .values({ npCommunicationId: remote.npCommunicationId, ...cols })
    .onConflictDoUpdate({ target: titles.npCommunicationId, set: cols });
}

/** Reloads groups, definitions and user state of one title and stores them completely. */
export async function syncTitle(
  db: Db,
  gw: PsnGateway,
  auth: PsnAuth,
  remote: RemoteTitle,
  now: Date,
): Promise<{ trophiesUpdated: number }> {
  const ref = { npCommunicationId: remote.npCommunicationId, npServiceName: remote.npServiceName };
  const titleId = remote.npCommunicationId;
  const groups = await gw.getGroups(auth, ref);
  const defs = await gw.getTrophyDefs(auth, ref);
  const userTrophies = await gw.getUserTrophies(auth, ref);
  const userById = new Map(userTrophies.map((u) => [u.trophyId, u]));

  const groupRows = groups.map((g) => ({
    titleId,
    groupId: g.groupId,
    name: g.name,
    iconUrl: g.iconUrl,
    definedPlatinum: g.defined.platinum,
    definedGold: g.defined.gold,
    definedSilver: g.defined.silver,
    definedBronze: g.defined.bronze,
  }));

  const trophyRows = defs.map((d) => {
    const u = userById.get(d.trophyId);
    const earned = u?.earned ?? false;
    return {
      titleId,
      trophyId: d.trophyId,
      groupId: d.groupId,
      type: d.type,
      name: d.name,
      detail: d.detail,
      iconUrl: d.iconUrl,
      hidden: d.hidden,
      earned,
      earnedAt: earned ? (u?.earnedAt ?? null) : null,
      earnedRate: u?.earnedRate == null ? null : u.earnedRate.toFixed(2),
      rareCategory: u?.rareCategory ?? null,
      progressTarget: u?.progressTarget ?? null,
    };
  });

  const earnedTimes = trophyRows
    .filter((r) => r.earned && r.earnedAt !== null)
    .map((r) => (r.earnedAt as Date).getTime());
  const firstTrophyAt = earnedTimes.length ? new Date(Math.min(...earnedTimes)) : null;
  const lastTrophyAt = earnedTimes.length ? new Date(Math.max(...earnedTimes)) : null;

  await db.transaction(async (tx) => {
    await upsertTitleRow(tx, remote, now);

    for (const row of groupRows) {
      const { titleId: _t, groupId: _g, ...set } = row;
      await tx
        .insert(trophyGroups)
        .values(row)
        .onConflictDoUpdate({ target: [trophyGroups.titleId, trophyGroups.groupId], set });
    }
    const groupIds = groupRows.map((g) => g.groupId);
    await tx
      .delete(trophyGroups)
      .where(
        groupIds.length
          ? and(eq(trophyGroups.titleId, titleId), notInArray(trophyGroups.groupId, groupIds))
          : eq(trophyGroups.titleId, titleId),
      );

    // Chunked: Postgres caps bind parameters per statement.
    const CHUNK = 500;
    for (let i = 0; i < trophyRows.length; i += CHUNK) {
      await tx
        .insert(trophies)
        .values(trophyRows.slice(i, i + CHUNK))
        .onConflictDoUpdate({
          target: [trophies.titleId, trophies.trophyId],
          set: {
            groupId: sqlExcluded("group_id"),
            type: sqlExcluded("type"),
            name: sqlExcluded("name"),
            detail: sqlExcluded("detail"),
            iconUrl: sqlExcluded("icon_url"),
            hidden: sqlExcluded("hidden"),
            earned: sqlExcluded("earned"),
            earnedAt: sqlExcluded("earned_at"),
            earnedRate: sqlExcluded("earned_rate"),
            rareCategory: sqlExcluded("rare_category"),
            progressTarget: sqlExcluded("progress_target"),
          },
        });
    }
    const trophyIds = trophyRows.map((t) => t.trophyId);
    await tx
      .delete(trophies)
      .where(
        trophyIds.length
          ? and(eq(trophies.titleId, titleId), notInArray(trophies.trophyId, trophyIds))
          : eq(trophies.titleId, titleId),
      );

    await tx
      .update(titles)
      .set({ syncedAt: now, groupsCheckedAt: now, firstTrophyAt, lastTrophyAt })
      .where(eq(titles.npCommunicationId, titleId));
  });

  return { trophiesUpdated: trophyRows.length };
}
