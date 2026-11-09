import { and, desc, eq, isNotNull } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { titles, trophies } from "@/src/db/schema";
import type { Platinum } from "@/src/plat-wall/query";

/** Earned platinums of visible games, newest first. */
export async function loadPlatinums(db: Db): Promise<Platinum[]> {
  const rows = await db
    .select({
      titleId: titles.npCommunicationId,
      game: titles.name,
      iconUrl: trophies.iconUrl,
      earnedAt: trophies.earnedAt,
      rate: trophies.earnedRate,
      platforms: titles.platforms,
    })
    .from(trophies)
    .innerJoin(titles, eq(trophies.titleId, titles.npCommunicationId))
    .where(
      and(
        eq(trophies.type, "platinum"),
        eq(trophies.earned, true),
        isNotNull(trophies.earnedAt),
        eq(titles.hidden, false),
      ),
    )
    .orderBy(desc(trophies.earnedAt), titles.npCommunicationId);
  return rows.map((r) => ({
    titleId: r.titleId,
    game: r.game,
    iconUrl: r.iconUrl,
    earnedAt: r.earnedAt!,
    rate: r.rate == null ? null : Number(r.rate),
    platforms: r.platforms,
  }));
}
