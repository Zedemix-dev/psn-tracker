import type { Db } from "@/src/db/client";
import { playedGames, titles, trophies, trophyGroups, type TrophyType } from "@/src/db/schema";

export type TitleSeed = {
  id: string;
  name?: string;
  defined?: number;
  earned?: number;
  progress?: number;
  hidden?: boolean;
  playSeconds?: number | null;
  platforms?: string[];
  publisher?: string | null;
  genres?: string[] | null;
  releaseDate?: Date | null;
};

export async function insertTitle(db: Db, seed: TitleSeed): Promise<void> {
  const { id, name = `Game ${id}`, defined = 0, earned = 0, hidden = false, playSeconds = null, platforms = ["PS5"] } = seed;
  await db.insert(titles).values({
    npCommunicationId: id,
    npServiceName: "trophy",
    name,
    iconUrl: "https://img.example/icon.png",
    platforms,
    trophySetVersion: "1.00",
    definedBronze: defined,
    earnedBronze: earned,
    progress: seed.progress ?? (defined === 0 ? 0 : Math.floor((earned / defined) * 100)),
    hidden,
    playSeconds,
    publisher: seed.publisher ?? null,
    genres: seed.genres ?? null,
    releaseDate: seed.releaseDate ?? null,
  });
}

/** A played game linked to the trophy lists `titleIds`. */
export async function insertPlayedGame(
  db: Db,
  seed: { id: string; titleIds: string[]; playSeconds: number },
): Promise<void> {
  await db.insert(playedGames).values({
    npTitleId: seed.id,
    npCommunicationIds: seed.titleIds,
    name: `Played ${seed.id}`,
    playSeconds: seed.playSeconds,
  });
}

export type TrophySeed = {
  titleId: string;
  trophyId: number;
  /** "default" when absent. */
  groupId?: string;
  type?: TrophyType;
  earnedAt?: Date | null;
  /** A number, or null for an unknown rate. */
  earnedRate?: number | null;
  name?: string;
  detail?: string | null;
  unobtainable?: boolean;
};

export async function insertTrophies(db: Db, seeds: TrophySeed[]): Promise<void> {
  if (seeds.length === 0) return;
  await db.insert(trophies).values(
    seeds.map((s) => ({
      titleId: s.titleId,
      trophyId: s.trophyId,
      groupId: s.groupId ?? "default",
      type: s.type ?? "bronze",
      name: s.name ?? `Trophy ${s.trophyId}`,
      detail: s.detail === undefined ? `Do thing ${s.trophyId}` : s.detail,
      iconUrl: `https://img.example/t${s.trophyId}.png`,
      earned: s.earnedAt != null,
      earnedAt: s.earnedAt ?? null,
      earnedRate: s.earnedRate == null ? null : s.earnedRate.toFixed(2),
      unobtainable: s.unobtainable ?? false,
    })),
  );
}

export async function insertGroup(db: Db, seed: { titleId: string; groupId: string; name: string }): Promise<void> {
  await db.insert(trophyGroups).values(seed);
}
