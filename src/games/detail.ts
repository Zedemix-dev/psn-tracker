import { asc, eq } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { titles, trophies, trophyGroups, type TrophyType } from "@/src/db/schema";
import {
  buildTimeline,
  groupProgress,
  pointsOf,
  rarityBreakdownOf,
  rarityStats,
  typeCounts,
  type TimelineRow,
} from "@/src/games/detail-stats";
import { gameStatus, progressRank, type GameRank, type GameStatus } from "@/src/games/row";
import { guideSearchName, powerPyxRoadmapUrl, psnProfilesGuidesUrl } from "@/src/lib/guide-links";
import { formatDate, formatInt, formatPercent, formatPlayTime, formatTime } from "@/src/lib/format";
import { rarityTier, type RarityTier } from "@/src/lib/rarity";
import { type ImageMap, mediaSrc } from "@/src/sync/images";

export type TrophyRowData = {
  id: number;
  groupId: string;
  type: TrophyType;
  name: string;
  detail: string;
  iconSrc: string;
  earned: boolean;
  earnedDate: string | null;
  earnedTime: string | null;
  earnedAtMs: number | null;
  rate: number | null;
  rateLabel: string | null;
  tier: RarityTier | null;
  /** "3,626/5,000": unearned trophy whose target and progress are both known. */
  counter: string | null;
};

export type GroupData = {
  id: string;
  kicker: string;
  name: string;
  iconSrc: string;
  earned: number;
  total: number;
  counts: Record<TrophyType, [number, number]>;
  progress: number;
  rank: GameRank;
  status: GameStatus;
};

export type GameDetail = {
  id: string;
  name: string;
  platforms: ("PS4" | "PS5")[];
  coverSrc: string;
  coverIsIcon: boolean;
  /** Path relative to MEDIA_DIR; null when not downloaded yet. */
  bannerPath: string | null;
  logoSrc: string | null;
  metaParts: string[];
  counts: Record<TrophyType, [number, number]>;
  progress: number;
  rank: GameRank;
  status: GameStatus;
  earnedTotal: number;
  definedTotal: number;
  points: { total: number; earned: number };
  groups: GroupData[];
  trophies: TrophyRowData[];
  breakdown: Record<RarityTier, number>;
  rarity: { average: string; lowest: string; median: string; highest: string } | null;
  publisher: string | null;
  genres: string | null;
  releaseDate: string | null;
  guides: { powerPyx: string; psnProfiles: string };
  timeline: TimelineRow[];
};

export async function getGameDetail(
  db: Db,
  id: string,
  imageMap: ImageMap,
  now: Date,
): Promise<GameDetail | null> {
  const [title] = await db.select().from(titles).where(eq(titles.npCommunicationId, id));
  if (!title) return null;
  const rows = await db
    .select()
    .from(trophies)
    .where(eq(trophies.titleId, id))
    .orderBy(asc(trophies.trophyId));
  const groupRows = await db.select().from(trophyGroups).where(eq(trophyGroups.titleId, id));

  const trophyRows: TrophyRowData[] = rows.map((r) => {
    const rate = r.earnedRate == null ? null : Number(r.earnedRate);
    return {
      id: r.trophyId,
      groupId: r.groupId,
      type: r.type,
      name: r.name,
      detail: r.detail ?? "",
      iconSrc: mediaSrc(r.iconUrl, imageMap),
      earned: r.earned,
      earnedDate: r.earnedAt ? formatDate(r.earnedAt) : null,
      earnedTime: r.earnedAt ? formatTime(r.earnedAt) : null,
      earnedAtMs: r.earnedAt ? r.earnedAt.getTime() : null,
      rate,
      rateLabel: rate == null ? null : formatPercent(rate),
      tier: rate == null ? null : rarityTier(rate),
      counter:
        !r.earned && r.progressTarget != null && r.progress != null && r.progress > 0
          ? `${formatInt(r.progress)}/${formatInt(r.progressTarget)}`
          : null,
    };
  });

  // Groups: "default" first, then the others by ascending groupId. Groups only known from trophies are kept.
  const groupInfo = new Map(groupRows.map((g) => [g.groupId, g]));
  const groupIds = [...new Set([...groupInfo.keys(), ...rows.map((r) => r.groupId)])].sort((a, b) =>
    a === "default" ? -1 : b === "default" ? 1 : a < b ? -1 : a > b ? 1 : 0,
  );
  const groups: GroupData[] = groupIds.map((gid, i) => {
    const members = rows.filter((r) => r.groupId === gid);
    const counts = typeCounts(members);
    const progress = groupProgress(members);
    const hasPlat = counts.platinum[1] > 0;
    const status: GameStatus = hasPlat
      ? counts.platinum[0] > 0
        ? "plat-earned"
        : "plat-missing"
      : progress >= 100
        ? "complete"
        : "incomplete";
    const info = groupInfo.get(gid);
    return {
      id: gid,
      kicker: i === 0 ? "Base game" : `DLC ${i}`,
      name: gid === "default" ? title.name : (info?.name ?? gid),
      iconSrc: mediaSrc(gid === "default" ? title.iconUrl : (info?.iconUrl ?? null), imageMap),
      earned: members.filter((m) => m.earned).length,
      total: members.length,
      counts,
      progress,
      rank: progressRank(progress),
      status,
    };
  });

  const rates = trophyRows.map((t) => t.rate);
  const stats = rarityStats(rates);
  const earnedRows = rows.filter((r) => r.earned && r.earnedAt);
  const earnedTotal = title.earnedPlatinum + title.earnedGold + title.earnedSilver + title.earnedBronze;
  const definedTotal = title.definedPlatinum + title.definedGold + title.definedSilver + title.definedBronze;
  const lastPlayed = title.lastPlayedAt ?? title.lastTrophyAt;
  const metaParts = [`${earnedTotal} of ${definedTotal} trophies`];
  if (lastPlayed) metaParts.push(`Last played ${formatDate(lastPlayed)}`);
  if (title.playSeconds != null) metaParts.push(`${formatPlayTime(title.playSeconds)} played`);
  const guideName = guideSearchName(title.name);

  return {
    id: title.npCommunicationId,
    name: title.name,
    platforms: (["PS4", "PS5"] as const).filter((p) => title.platforms.includes(p)),
    coverSrc: mediaSrc(title.coverUrl ?? title.iconUrl, imageMap, "full"),
    coverIsIcon: title.coverUrl == null,
    bannerPath: title.bannerUrl ? (imageMap.get(title.bannerUrl)?.path ?? null) : null,
    logoSrc: title.logoUrl && imageMap.has(title.logoUrl) ? mediaSrc(title.logoUrl, imageMap, "full") : null,
    metaParts,
    counts: {
      platinum: [title.earnedPlatinum, title.definedPlatinum],
      gold: [title.earnedGold, title.definedGold],
      silver: [title.earnedSilver, title.definedSilver],
      bronze: [title.earnedBronze, title.definedBronze],
    },
    progress: title.progress,
    rank: progressRank(title.progress),
    status: gameStatus(title),
    earnedTotal,
    definedTotal,
    points: pointsOf(rows),
    groups,
    trophies: trophyRows,
    breakdown: rarityBreakdownOf(rates),
    rarity: stats
      ? {
          average: formatPercent(stats.average),
          lowest: formatPercent(stats.lowest),
          median: formatPercent(stats.median),
          highest: formatPercent(stats.highest),
        }
      : null,
    publisher: title.publisher ?? null,
    genres: title.genres && title.genres.length > 0 ? title.genres.join(", ") : null,
    releaseDate: title.releaseDate ? formatDate(title.releaseDate) : null,
    guides: { powerPyx: powerPyxRoadmapUrl(guideName), psnProfiles: psnProfilesGuidesUrl(guideName) },
    timeline: buildTimeline(
      earnedRows.map((r) => ({ type: r.type, earnedAt: r.earnedAt as Date })),
      title.definedPlatinum > 0,
      now,
    ),
  };
}
