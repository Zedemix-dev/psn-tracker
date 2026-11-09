import { desc, eq, isNotNull, and, sql } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { images, titles } from "@/src/db/schema";
import { getSettings } from "@/src/settings/repo";

export type PageBanner = { path: string; posY: number; source: "custom" | "auto"; gameName: string | null };

const AUTO_POS_Y = 25;

/** Custom banner if any, else the banner of the last played visible game (once downloaded). */
export async function getPageBanner(db: Db): Promise<PageBanner | null> {
  const s = await getSettings(db);
  if (s.bannerPath) return { path: s.bannerPath, posY: s.bannerPosY, source: "custom", gameName: null };
  const [row] = await db
    .select({ path: images.localPath, name: titles.name })
    .from(titles)
    .innerJoin(images, eq(images.url, titles.bannerUrl))
    .where(and(eq(titles.hidden, false), isNotNull(images.localPath)))
    .orderBy(sql`${titles.lastPlayedAt} desc nulls last`, desc(titles.npCommunicationId))
    .limit(1);
  if (!row?.path) return null;
  return { path: row.path, posY: AUTO_POS_Y, source: "auto", gameName: row.name };
}
