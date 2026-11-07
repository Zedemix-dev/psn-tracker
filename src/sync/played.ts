import { eq, isNull, sql } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { playedGames, titles } from "@/src/db/schema";
import type { PsnAuth, PsnGateway } from "@/src/psn/gateway";

// Postgres caps bind parameters per statement.
const CHUNK = 500;

type TitleTotals = {
  playSeconds: number;
  playCount: number;
  lastPlayedAt: Date | null;
  coverUrl: string | null;
  coverPlayedAt: Date | null;
};

/**
 * Stores PSN's played-games list, links new npTitleIds to their trophy lists
 * (cached in npCommunicationIds; [] = looked up, no trophy list) and
 * recomputes cover and play time of every linked title from the full table.
 * A title without any linked played game keeps its previous values.
 */
export async function syncPlayedGames(db: Db, gw: PsnGateway, auth: PsnAuth): Promise<void> {
  const remote = await gw.getPlayedGames(auth);

  for (let i = 0; i < remote.length; i += CHUNK) {
    await db
      .insert(playedGames)
      .values(remote.slice(i, i + CHUNK))
      .onConflictDoUpdate({
        target: playedGames.npTitleId,
        set: {
          name: sql.raw('excluded."name"'),
          imageUrl: sql.raw('excluded."image_url"'),
          playSeconds: sql.raw('excluded."play_seconds"'),
          playCount: sql.raw('excluded."play_count"'),
          firstPlayedAt: sql.raw('excluded."first_played_at"'),
          lastPlayedAt: sql.raw('excluded."last_played_at"'),
        },
      });
  }

  const unlinked = await db
    .select({ npTitleId: playedGames.npTitleId })
    .from(playedGames)
    .where(isNull(playedGames.npCommunicationIds));
  if (unlinked.length > 0) {
    const ids = unlinked.map((r) => r.npTitleId);
    const mapping = await gw.mapNpTitleIds(auth, ids);
    await db.transaction(async (tx) => {
      for (const id of ids) {
        await tx
          .update(playedGames)
          .set({ npCommunicationIds: mapping[id] ?? [] })
          .where(eq(playedGames.npTitleId, id));
      }
    });
  }

  const all = await db.select().from(playedGames);
  const totals = new Map<string, TitleTotals>();
  for (const game of all) {
    for (const titleId of game.npCommunicationIds ?? []) {
      const t = totals.get(titleId) ?? {
        playSeconds: 0,
        playCount: 0,
        lastPlayedAt: null,
        coverUrl: null,
        coverPlayedAt: null,
      };
      t.playSeconds += game.playSeconds;
      t.playCount += game.playCount;
      if (game.lastPlayedAt && (!t.lastPlayedAt || game.lastPlayedAt > t.lastPlayedAt)) {
        t.lastPlayedAt = game.lastPlayedAt;
      }
      // Cover: most recently played game; a game with a date beats one without.
      const newer =
        t.coverPlayedAt === null
          ? t.coverUrl === null || game.lastPlayedAt !== null
          : game.lastPlayedAt !== null && game.lastPlayedAt > t.coverPlayedAt;
      if (newer && game.imageUrl) {
        t.coverUrl = game.imageUrl;
        t.coverPlayedAt = game.lastPlayedAt;
      }
      totals.set(titleId, t);
    }
  }

  await db.transaction(async (tx) => {
    for (const [titleId, t] of totals) {
      await tx
        .update(titles)
        .set({
          playSeconds: t.playSeconds,
          playCount: t.playCount,
          lastPlayedAt: t.lastPlayedAt,
          ...(t.coverUrl ? { coverUrl: t.coverUrl } : {}),
        })
        .where(eq(titles.npCommunicationId, titleId));
    }
  });
}
