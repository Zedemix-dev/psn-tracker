import path from "node:path";
import { eq } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { profile } from "@/src/db/schema";
import type { ExportInput } from "@/src/plat-wall/export-render";
import { loadPlatinums } from "@/src/plat-wall/load";
import { applyPlatQuery, exportFileName, type PlatQuery } from "@/src/plat-wall/query";
import { getPageBanner } from "@/src/settings/page-banner";
import { getSettings } from "@/src/settings/repo";
import { getProfileStats } from "@/src/stats/profile-stats";
import { loadImageMap } from "@/src/sync/images";

/** Everything the PNG shows, or null when no platinum matches the query. */
export async function loadExportInput(
  db: Db,
  query: PlatQuery,
  mediaDir: string,
): Promise<{ input: ExportInput; fileName: string } | null> {
  const tiles = applyPlatQuery(await loadPlatinums(db), query);
  if (tiles.length === 0) return null;

  const { hideZero } = await getSettings(db);
  const [[row], stats, banner, images] = await Promise.all([
    db.select().from(profile).where(eq(profile.id, 1)).limit(1),
    getProfileStats(db, { hideZero }),
    getPageBanner(db),
    loadImageMap(db),
  ]);

  const file = (url: string | null): string | null => {
    const entry = url ? images.get(url) : undefined;
    const rel = entry ? (entry.thumb ?? entry.path) : null;
    return rel ? path.join(mediaDir, rel) : null;
  };
  const onlineId = row?.onlineId ?? "PSN profile";

  return {
    input: {
      profile: {
        onlineId,
        avatarFile: file(row?.avatarUrl ?? null),
        level: row?.level ?? null,
        levelProgress: row?.levelProgress ?? 0,
        tier: row?.tier ?? 1,
        platinum: row?.earnedPlatinum ?? 0,
        gold: row?.earnedGold ?? 0,
        silver: row?.earnedSilver ?? 0,
        bronze: row?.earnedBronze ?? 0,
      },
      stats,
      banner: banner ? { file: path.join(mediaDir, banner.path), posY: banner.posY } : null,
      tiles: tiles.map((t) => ({ file: file(t.iconUrl), game: t.game, rate: t.rate })),
      show: query.show,
    },
    fileName: exportFileName(onlineId, query),
  };
}
