import type { Db } from "@/src/db/client";
import type { TrophyType } from "@/src/db/schema";
import { gameImages } from "@/src/games/game-image";
import { loadSiblingIndex } from "@/src/games/siblings";
import { formatDateAndTime, formatPercent, parisDateParts } from "@/src/lib/format";
import { cachedUntilNextRun } from "@/src/lib/per-sync-cache";
import { rarityTier, type RarityTier } from "@/src/lib/rarity";
import { loadImageMap, mediaSrc } from "@/src/sync/images";
import { buildGameCharts, type GameCharts } from "./game-charts";
import { levelCrossings } from "./level-history";
import { buildTrophyCharts, type TrophyCharts } from "./trophy-charts";
import { getAllEarned } from "./trophies";

/** JSON-safe: one row of the level history (spec 18.10). */
export type LevelRow = {
  key: string; // `${titleId}:${trophyId}`
  level: number;
  tier: number; // PSN level icon, 1..10
  earnedAtMs: number;
  name: string;
  detail: string;
  iconSrc: string;
  type: TrophyType;
  gameId: string;
  gameName: string;
  gameSrc: string; // the image of the game's row in Games
  gameIsIcon: boolean;
  gameTileBg: string | null;
  date: string; // "9 Nov 2026"
  time: string; // "15:46:30"
  ratePct: string | null; // "18.30%"
  rarity: RarityTier | null;
};

export type StatsData = TrophyCharts & GameCharts & { levels: LevelRow[] }; // levels newest first

/** `YYYY-MM-DD` in Paris: the charts are relative to today, so the cached data lasts one Paris day at most. */
function parisDay(d: Date): string {
  const { year, month, day } = parisDateParts(d);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Kept until the next run and until midnight in Paris; the result is shared, so callers must not modify it. */
export function getStatsData(db: Db, opts: { hideZero: boolean; now?: Date }): Promise<StatsData> {
  const now = opts.now ?? new Date();
  return cachedUntilNextRun(db, `stats:${opts.hideZero}`, () => computeStatsData(db, { ...opts, now }), parisDay(now));
}

async function computeStatsData(db: Db, opts: { hideZero: boolean; now: Date }): Promise<StatsData> {
  const [earned, siblings, imageMap] = await Promise.all([
    getAllEarned(db),
    loadSiblingIndex(db),
    loadImageMap(db),
  ]);

  const games = [...siblings.values()].flat().filter((t) => !(opts.hideZero && t.progress === 0));
  const imageOf = gameImages(siblings, imageMap);

  const levels = levelCrossings(earned)
    .map(({ level, trophy }): LevelRow => {
      const { date, time } = formatDateAndTime(trophy.earnedAt);
      return {
        key: `${trophy.titleId}:${trophy.trophyId}`,
        level,
        tier: Math.min(10, Math.floor(level / 100) + 1),
        earnedAtMs: trophy.earnedAt.getTime(),
        name: trophy.name,
        detail: trophy.detail,
        iconSrc: mediaSrc(trophy.iconUrl, imageMap),
        type: trophy.type,
        gameId: trophy.titleId,
        gameName: trophy.gameName,
        ...imageOf(trophy.titleId),
        date,
        time,
        ratePct: trophy.earnedRate == null ? null : formatPercent(trophy.earnedRate),
        rarity: trophy.earnedRate == null ? null : rarityTier(trophy.earnedRate),
      };
    })
    .reverse();

  return {
    ...buildTrophyCharts(earned, opts.now),
    ...buildGameCharts(games, siblings),
    levels,
  };
}
