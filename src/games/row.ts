import type { titles, TrophyType } from "@/src/db/schema";
import { formatLastPlayedLine } from "@/src/lib/format";
import { unobtainableLabel } from "@/src/unobtainable/labels";
import { notePlainText } from "@/src/unobtainable/note";
import { type SiblingIndex, withSiblings } from "@/src/games/siblings";
import { type ImageMap, mediaSrc } from "@/src/sync/images";

export type GameStatus = "plat-earned" | "plat-missing" | "complete" | "incomplete";
export type GameRank = "S" | "A" | "B" | "C" | "D" | "E" | "F";

export type GameRowData = {
  id: string;
  name: string;
  platforms: ("PS4" | "PS5")[];
  coverSrc: string;
  /** True when the title has no cover art and coverSrc is the (square) trophy-list icon. */
  coverIsIcon: boolean;
  earnedTotal: number;
  definedTotal: number;
  counts: Record<TrophyType, [earned: number, defined: number]>;
  progress: number;
  rank: GameRank;
  lastPlayedLine: string;
  status: GameStatus;
  /** Set when the list marks trophies of this game as unobtainable. */
  unobtainable: { label: string; note: string | null } | null;
};

export type GameTitle = typeof titles.$inferSelect;

export function progressRank(progress: number): GameRank {
  if (progress >= 100) return "S";
  if (progress >= 80) return "A";
  if (progress >= 60) return "B";
  if (progress >= 40) return "C";
  if (progress >= 20) return "D";
  if (progress >= 1) return "E";
  return "F";
}

export function gameStatus(
  t: Pick<GameTitle, "earnedPlatinum" | "definedPlatinum" | "progress">,
): GameStatus {
  if (t.earnedPlatinum > 0) return "plat-earned";
  if (t.definedPlatinum > 0) return "plat-missing";
  return t.progress >= 100 ? "complete" : "incomplete";
}

export function toGameRow(title: GameTitle, imageMap: ImageMap, siblings: SiblingIndex): GameRowData {
  const info = withSiblings(title, siblings);
  const earnedTotal =
    title.earnedPlatinum + title.earnedGold + title.earnedSilver + title.earnedBronze;
  const definedTotal =
    title.definedPlatinum + title.definedGold + title.definedSilver + title.definedBronze;
  return {
    id: title.npCommunicationId,
    name: title.name,
    platforms: (["PS4", "PS5"] as const).filter((p) => title.platforms.includes(p)),
    coverSrc: mediaSrc(info.coverUrl ?? info.coverFallbackUrl, imageMap),
    coverIsIcon: info.coverIsIcon,
    earnedTotal,
    definedTotal,
    counts: {
      platinum: [title.earnedPlatinum, title.definedPlatinum],
      gold: [title.earnedGold, title.definedGold],
      silver: [title.earnedSilver, title.definedSilver],
      bronze: [title.earnedBronze, title.definedBronze],
    },
    progress: title.progress,
    rank: progressRank(title.progress),
    lastPlayedLine: formatLastPlayedLine(
      title.lastPlayedAt ?? title.lastTrophyAt,
      title.playSeconds,
    ),
    status: gameStatus(title),
    unobtainable:
      title.unobtainableCount > 0
        ? {
            label: unobtainableLabel(title.unobtainableCount, definedTotal),
            note: notePlainText(title.unobtainableNote),
          }
        : null,
  };
}
