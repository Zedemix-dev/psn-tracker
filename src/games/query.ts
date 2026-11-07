import { and, asc, eq, gt, ilike, lt, ne, sql, type SQL } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { titles, trophies } from "@/src/db/schema";
import { toGameRow, type GameRowData } from "@/src/games/row";
import { loadImageMap } from "@/src/sync/images";

export const GAME_STATES = ["all", "100", "not100", "notFinished", "platinum", "platinumNot100"] as const;
export const GAME_PLATFORMS = ["all", "PS4", "PS5"] as const;
export const GAME_SORTS = [
  "lastPlayed",
  "lastTrophy",
  "alphabetical",
  "percent",
  "timePlayed",
  "totalTrophies",
  "earnedTrophies",
  "unearnedTrophies",
  "platinumRarity",
] as const;

export type GameState = (typeof GAME_STATES)[number];
export type GamePlatform = (typeof GAME_PLATFORMS)[number];
export type GameSort = (typeof GAME_SORTS)[number];
export type GameQuery = {
  state: GameState;
  platform: GamePlatform;
  sort: GameSort;
  q: string;
  offset: number;
};

export const PAGE_SIZE = 50;

function pick<T extends string>(allowed: readonly T[], value: string | null, fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function parseGameQuery(params: URLSearchParams): GameQuery {
  const offset = Number.parseInt(params.get("offset") ?? "", 10);
  return {
    state: pick(GAME_STATES, params.get("state"), "all"),
    platform: pick(GAME_PLATFORMS, params.get("platform"), "all"),
    sort: pick(GAME_SORTS, params.get("sort"), "lastPlayed"),
    q: (params.get("q") ?? "").trim(),
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
  };
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

const definedTotal = sql`(${titles.definedPlatinum} + ${titles.definedGold} + ${titles.definedSilver} + ${titles.definedBronze})`;
const earnedTotal = sql`(${titles.earnedPlatinum} + ${titles.earnedGold} + ${titles.earnedSilver} + ${titles.earnedBronze})`;
const platinumRate = sql`(select ${trophies.earnedRate} from ${trophies} where ${trophies.titleId} = ${titles.npCommunicationId} and ${trophies.type} = 'platinum' limit 1)`;

const desc = (e: SQL) => sql`${e} desc nulls last`;
const ascNullsLast = (e: SQL) => sql`${e} asc nulls last`;

function orderFor(sort: GameSort): SQL {
  switch (sort) {
    case "lastPlayed":
      return desc(sql`coalesce(${titles.lastPlayedAt}, ${titles.lastTrophyAt})`);
    case "lastTrophy":
      return desc(sql`${titles.lastTrophyAt}`);
    case "alphabetical":
      return ascNullsLast(sql`lower(${titles.name})`);
    case "percent":
      return desc(sql`${titles.progress}`);
    case "timePlayed":
      return desc(sql`${titles.playSeconds}`);
    case "totalTrophies":
      return desc(definedTotal);
    case "earnedTrophies":
      return desc(earnedTotal);
    case "unearnedTrophies":
      return desc(sql`(${definedTotal} - ${earnedTotal})`);
    case "platinumRarity":
      return ascNullsLast(platinumRate);
  }
}

function filtersFor(query: GameQuery, hideZero: boolean): SQL | undefined {
  const conds: SQL[] = [eq(titles.hidden, false)];
  if (hideZero) conds.push(ne(titles.progress, 0));
  switch (query.state) {
    case "100":
      conds.push(eq(titles.progress, 100));
      break;
    case "not100":
      conds.push(lt(titles.progress, 100));
      break;
    case "notFinished":
      conds.push(lt(titles.progress, 100), eq(titles.earnedPlatinum, 0));
      break;
    case "platinum":
      conds.push(gt(titles.earnedPlatinum, 0));
      break;
    case "platinumNot100":
      conds.push(gt(titles.earnedPlatinum, 0), lt(titles.progress, 100));
      break;
  }
  if (query.platform !== "all") conds.push(sql`${query.platform} = any(${titles.platforms})`);
  if (query.q) conds.push(ilike(titles.name, `%${escapeLike(query.q)}%`));
  return and(...conds);
}

export async function queryGames(
  db: Db,
  query: GameQuery,
  { hideZero }: { hideZero: boolean },
): Promise<{ items: GameRowData[]; total: number }> {
  const where = filtersFor(query, hideZero);
  const [rows, [count], imageMap] = await Promise.all([
    db
      .select()
      .from(titles)
      .where(where)
      .orderBy(orderFor(query.sort), asc(sql`lower(${titles.name})`), asc(titles.npCommunicationId))
      .limit(PAGE_SIZE)
      .offset(Math.max(0, query.offset)),
    db.select({ n: sql<number>`count(*)::int` }).from(titles).where(where),
    loadImageMap(db),
  ]);
  return { items: rows.map((r) => toGameRow(r, imageMap)), total: count.n };
}
