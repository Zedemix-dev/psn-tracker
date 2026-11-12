import type { playedGames, titles } from "@/src/db/schema";

type PlayedRow = typeof playedGames.$inferInsert;
type TitleRow = typeof titles.$inferInsert;

/**
 * One played game per seeded trophy list that has play time, linked to that list, so the profile's
 * "Hours played" is not 0 h. np_title_id is a made-up console title id (the key of played_games).
 */
export function playedGameRows(titleRows: TitleRow[]): PlayedRow[] {
  return titleRows
    .filter((t) => (t.playSeconds ?? 0) > 0)
    .map((t) => ({
      npTitleId: `${t.npServiceName === "trophy2" ? "PPSA" : "CUSA"}_${t.npCommunicationId}`,
      npCommunicationIds: [t.npCommunicationId],
      name: t.name,
      playSeconds: t.playSeconds!,
      playCount: t.playCount ?? 1,
      lastPlayedAt: t.lastPlayedAt ?? null,
    }));
}
