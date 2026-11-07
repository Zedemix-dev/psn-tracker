import { eq } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { titles } from "@/src/db/schema";
import type { RemoteTitle } from "@/src/psn/types";

/** The part of a `titles` row that decides whether a title must be reloaded. */
export type StoredTitleState = Pick<
  typeof titles.$inferSelect,
  | "lastTrophyAt"
  | "earnedPlatinum"
  | "earnedGold"
  | "earnedSilver"
  | "earnedBronze"
  | "definedPlatinum"
  | "definedGold"
  | "definedSilver"
  | "definedBronze"
  | "trophySetVersion"
  | "hasTrophyGroups"
>;

export async function loadTitleState(
  db: Db,
  npCommunicationId: string,
): Promise<StoredTitleState | null> {
  const [row] = await db
    .select({
      lastTrophyAt: titles.lastTrophyAt,
      earnedPlatinum: titles.earnedPlatinum,
      earnedGold: titles.earnedGold,
      earnedSilver: titles.earnedSilver,
      earnedBronze: titles.earnedBronze,
      definedPlatinum: titles.definedPlatinum,
      definedGold: titles.definedGold,
      definedSilver: titles.definedSilver,
      definedBronze: titles.definedBronze,
      trophySetVersion: titles.trophySetVersion,
      hasTrophyGroups: titles.hasTrophyGroups,
    })
    .from(titles)
    .where(eq(titles.npCommunicationId, npCommunicationId));
  return row ?? null;
}

const time = (d: Date | null) => (d === null ? null : d.getTime());

/** Spec 6.4: reload when the title was never seen or any change indicator differs. */
export function titleNeedsReload(stored: StoredTitleState | null, remote: RemoteTitle): boolean {
  if (stored === null) return true;
  return (
    time(stored.lastTrophyAt) !== time(remote.lastUpdatedAt) ||
    stored.earnedPlatinum !== remote.earned.platinum ||
    stored.earnedGold !== remote.earned.gold ||
    stored.earnedSilver !== remote.earned.silver ||
    stored.earnedBronze !== remote.earned.bronze ||
    stored.definedPlatinum !== remote.defined.platinum ||
    stored.definedGold !== remote.defined.gold ||
    stored.definedSilver !== remote.defined.silver ||
    stored.definedBronze !== remote.defined.bronze ||
    stored.trophySetVersion !== remote.trophySetVersion ||
    stored.hasTrophyGroups !== remote.hasTrophyGroups
  );
}
