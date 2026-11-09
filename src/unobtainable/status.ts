import { and, eq, gt, sql } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { titles, unobtainableList } from "@/src/db/schema";
import { formatDate, formatDateTime, formatInt } from "@/src/lib/format";
import { getSettings } from "@/src/settings/repo";

export type UnobtainableStatus = {
  url: string;
  badge: string;
  badgeClass: "valid" | "expired" | "";
  detail: string | null;
  busy: boolean;
};

export async function getUnobtainableStatus(db: Db): Promise<UnobtainableStatus> {
  const s = await getSettings(db);
  const [list] = await db
    .select({
      downloadedAt: unobtainableList.downloadedAt,
      attemptedAt: unobtainableList.attemptedAt,
      error: unobtainableList.error,
      count: sql<number>`jsonb_array_length(${unobtainableList.entries})`.mapWith(Number),
    })
    .from(unobtainableList)
    .where(eq(unobtainableList.id, 1));
  const url = s.unobtainableListUrl;

  if (s.unobtainableRequestedAt) return { url, badge: "Downloading…", badgeClass: "", detail: null, busy: true };

  if (list?.error) {
    const when = list.attemptedAt ? ` (${formatDateTime(list.attemptedAt)})` : "";
    const still = list.downloadedAt
      ? `still using the list from ${formatDate(list.downloadedAt)}`
      : "no list available yet";
    return { url, badge: "Download failed", badgeClass: "expired", detail: `${list.error}${when} · ${still}`, busy: false };
  }

  if (list?.downloadedAt) {
    const [mine] = await db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(titles)
      .where(and(gt(titles.unobtainableCount, 0), eq(titles.hidden, false)));
    const detail = `Downloaded ${formatDateTime(list.downloadedAt)} · ${formatInt(list.count)} games in the list · ${formatInt(mine.n)} of yours`;
    return { url, badge: "Up to date", badgeClass: "valid", detail, busy: false };
  }

  return { url, badge: "Not downloaded yet", badgeClass: "", detail: null, busy: false };
}
