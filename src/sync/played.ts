import { eq, isNull, sql } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { playedGames, titles } from "@/src/db/schema";
import type { PsnAuth, PsnGateway } from "@/src/psn/gateway";
import type { RemotePlayedGame } from "@/src/psn/types";

// Postgres caps bind parameters per statement.
const CHUNK = 500;

type TitleTotals = {
  playSeconds: number;
  playCount: number;
  lastPlayedAt: Date | null;
  coverUrl: string | null;
  coverPlayedAt: Date | null;
  concept: { id: number; bannerUrl: string | null; logoUrl: string | null } | null;
  conceptPlayedAt: Date | null;
};

/**
 * Stores PSN's played-games list, links new npTitleIds to their trophy lists
 * (cached in npCommunicationIds; [] = looked up, no trophy list) and
 * recomputes cover, concept and play time of every linked title from the full table.
 * A title without any linked played game keeps its previous values, and so does one
 * whose linked games have no concept. Returns the titles whose last played date changed
 * (and is not null) during the call.
 */
export async function syncPlayedGames(
  db: Db,
  gw: PsnGateway,
  auth: PsnAuth,
): Promise<{ replayedTitleIds: string[] }> {
  // A reordered page can list a game twice, and one upsert cannot touch a row twice: keep the first.
  const byId = new Map<string, RemotePlayedGame>();
  for (const game of await gw.getPlayedGames(auth)) {
    if (!byId.has(game.npTitleId)) byId.set(game.npTitleId, game);
  }
  const remote = [...byId.values()];

  for (let i = 0; i < remote.length; i += CHUNK) {
    await db
      .insert(playedGames)
      .values(
        remote.slice(i, i + CHUNK).map((g) => ({
          npTitleId: g.npTitleId,
          name: g.name,
          imageUrl: g.imageUrl,
          playSeconds: g.playSeconds,
          playCount: g.playCount,
          firstPlayedAt: g.firstPlayedAt,
          lastPlayedAt: g.lastPlayedAt,
          conceptId: g.concept?.id ?? null,
          bannerUrl: g.concept?.bannerUrl ?? null,
          logoUrl: g.concept?.logoUrl ?? null,
        })),
      )
      .onConflictDoUpdate({
        target: playedGames.npTitleId,
        set: {
          name: sql.raw('excluded."name"'),
          imageUrl: sql.raw('excluded."image_url"'),
          playSeconds: sql.raw('excluded."play_seconds"'),
          playCount: sql.raw('excluded."play_count"'),
          firstPlayedAt: sql.raw('excluded."first_played_at"'),
          lastPlayedAt: sql.raw('excluded."last_played_at"'),
          conceptId: sql.raw('excluded."concept_id"'),
          bannerUrl: sql.raw('excluded."banner_url"'),
          logoUrl: sql.raw('excluded."logo_url"'),
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
        concept: null,
        conceptPlayedAt: null,
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
      // Concept: same rule, among the linked games that have one.
      if (game.conceptId !== null) {
        const newerConcept =
          t.conceptPlayedAt === null
            ? t.concept === null || game.lastPlayedAt !== null
            : game.lastPlayedAt !== null && game.lastPlayedAt > t.conceptPlayedAt;
        if (newerConcept) {
          t.concept = { id: game.conceptId, bannerUrl: game.bannerUrl, logoUrl: game.logoUrl };
          t.conceptPlayedAt = game.lastPlayedAt;
        }
      }
      totals.set(titleId, t);
    }
  }

  const before = new Map(
    (await db.select({ id: titles.npCommunicationId, lastPlayedAt: titles.lastPlayedAt, conceptId: titles.conceptId }).from(titles)).map(
      (r) => [r.id, r] as const,
    ),
  );
  const replayedTitleIds: string[] = [];
  await db.transaction(async (tx) => {
    for (const [titleId, t] of totals) {
      const prev = before.get(titleId);
      if (!prev) continue;
      if (t.lastPlayedAt && t.lastPlayedAt.getTime() !== prev.lastPlayedAt?.getTime()) {
        replayedTitleIds.push(titleId);
      }
      // A new concept invalidates what the catalog said about the old one.
      const conceptChanged = t.concept !== null && t.concept.id !== prev.conceptId;
      await tx
        .update(titles)
        .set({
          playSeconds: t.playSeconds,
          playCount: t.playCount,
          lastPlayedAt: t.lastPlayedAt,
          ...(t.coverUrl ? { coverUrl: t.coverUrl } : {}),
          ...(t.concept
            ? { conceptId: t.concept.id, bannerUrl: t.concept.bannerUrl, logoUrl: t.concept.logoUrl }
            : {}),
          ...(conceptChanged
            ? { publisher: null, genres: null, releaseDate: null, catalogCheckedAt: null }
            : {}),
        })
        .where(eq(titles.npCommunicationId, titleId));
    }
  });
  return { replayedTitleIds };
}
