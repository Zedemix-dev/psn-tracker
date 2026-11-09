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
import { loadSiblingIndex, withSiblings } from "@/src/games/siblings";
import { guideSearchName, powerPyxRoadmapUrl, psnProfilesGuidesUrl } from "@/src/lib/guide-links";
import { formatDate, formatInt, formatPercent, formatPlayTime, formatTime } from "@/src/lib/format";
import { rarityTier, type RarityTier } from "@/src/lib/rarity";
import { type ImageMap, mediaSrc } from "@/src/sync/images";
import { unobtainableLabel, unobtainableSituation } from "@/src/unobtainable/labels";
import { parseNote, type NoteSegment } from "@/src/unobtainable/note";

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
  /** Marked as no longer obtainable by the community list. */
  unobtainable: boolean;
};

export type UnobtainableBand = { label: string; situation: string; note: NoteSegment[] };

export type GroupData = {
  id: string;
  kicker: string;
  name: string;
  iconSrc: string;
  /** The image is the page cover (PS4 list): fills its square frame instead of being contained. */
  iconIsCover: boolean;
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
  /** The banner is a hand-picked one (already 1920x520, shown without logo). */
  bannerIsOverride: boolean;
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
  /** Null when no trophy of the game is marked unobtainable. */
  unobtainable: UnobtainableBand | null;
};

export async function getGameDetail(
  db: Db,
  id: string,
  imageMap: ImageMap,
  now: Date,
): Promise<GameDetail | null> {
  const [title] = await db.select().from(titles).where(eq(titles.npCommunicationId, id));
  if (!title) return null;
  const info = withSiblings(title, await loadSiblingIndex(db));
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
        !r.earned && r.progressTarget != null && r.progress != null
          ? `${formatInt(r.progress)}/${formatInt(r.progressTarget)}`
          : null,
      unobtainable: r.unobtainable,
    };
  });

  // Groups: "default" first, then the others by ascending groupId. Groups only known from trophies are kept.
  const groupInfo = new Map(groupRows.map((g) => [g.groupId, g]));
  const groupIds = [...new Set([...groupInfo.keys(), ...rows.map((r) => r.groupId)])].sort((a, b) =>
    a === "default" ? -1 : b === "default" ? 1 : a < b ? -1 : a > b ? 1 : 0,
  );
  const coverSrc = mediaSrc(info.coverUrl ?? info.coverFallbackUrl, imageMap, "full");
  // PS4 lists show the Games-list image on every group (the cover, or the list icon when there is no cover);
  // PS5 lists keep each group icon.
  const groupsUseListImage = !title.platforms.includes("PS5");
  const groupsFillFrame = groupsUseListImage && !info.coverIsIcon;
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
      iconSrc: groupsUseListImage
        ? coverSrc
        : mediaSrc(gid === "default" ? title.iconUrl : (info?.iconUrl ?? null), imageMap),
      iconIsCover: groupsFillFrame,
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
  const missing = rows.filter((r) => r.unobtainable && !r.earned).length;
  const unobtainable: UnobtainableBand | null =
    title.unobtainableCount > 0
      ? {
          label: unobtainableLabel(title.unobtainableCount, definedTotal),
          situation: unobtainableSituation(title.unobtainableCount, missing),
          note: parseNote(title.unobtainableNote),
        }
      : null;
  const guideName = guideSearchName(title.name);

  return {
    id: title.npCommunicationId,
    name: title.name,
    platforms: (["PS4", "PS5"] as const).filter((p) => title.platforms.includes(p)),
    coverSrc,
    coverIsIcon: info.coverIsIcon,
    bannerPath: info.bannerUrl ? (imageMap.get(info.bannerUrl)?.path ?? null) : null,
    bannerIsOverride: info.bannerIsOverride,
    logoSrc: info.logoUrl && imageMap.has(info.logoUrl) ? mediaSrc(info.logoUrl, imageMap, "full") : null,
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
    publisher: info.publisher,
    genres: info.genres ? info.genres.join(", ") : null,
    releaseDate: info.releaseDate ? formatDate(info.releaseDate) : null,
    guides: { powerPyx: powerPyxRoadmapUrl(guideName), psnProfiles: psnProfilesGuidesUrl(guideName) },
    timeline: buildTimeline(
      earnedRows.map((r) => ({ type: r.type, earnedAt: r.earnedAt as Date })),
      title.definedPlatinum > 0,
      now,
    ),
    unobtainable,
  };
}
