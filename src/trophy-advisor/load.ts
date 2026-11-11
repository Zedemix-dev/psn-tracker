import { and, eq, ne, sql, type SQL } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { titles, trophies, trophyGroups, type TrophyType } from "@/src/db/schema";
import { gameImages } from "@/src/games/game-image";
import { toGameRow, type GameRank } from "@/src/games/row";
import { loadSiblingIndex } from "@/src/games/siblings";
import { formatCounter, formatPercent } from "@/src/lib/format";
import { rarityTier, type RarityTier } from "@/src/lib/rarity";
import { countTrophiesWhere, ofTitle, trophyFilters } from "@/src/lib/trophy-filters";
import { sortName } from "@/src/lib/sort-name";
import type { Settings } from "@/src/settings/repo";
import { loadImageMap, mediaSrc } from "@/src/sync/images";
import type { AdvisorQuery, AdvisorScope } from "@/src/trophy-advisor/query";
import { unobtainableLabel } from "@/src/unobtainable/labels";
import { notePlainText } from "@/src/unobtainable/note";

/** JSON-safe: what one row of the Trophy Advisor shows. */
export type AdvisorRow = {
  key: string; // `${titleId}:${trophyId}`
  name: string;
  detail: string;
  iconSrc: string;
  type: TrophyType;
  gameId: string;
  gameName: string;
  gameSrc: string; // the image of the game's row in Games
  gameIsIcon: boolean; // true: the trophy-list icon, shown whole on its tile
  gameTileBg: string | null; // the stored colour of that tile
  dlc: string | null; // group name, only when groupId is not "default"
  platforms: ("PS4" | "PS5")[];
  counter: string | null; // "3,626/5,000", only with a target and a progress
  ratePct: string | null; // "4.60%"
  tier: RarityTier | null;
  unobtainable: boolean;
  unobtainableNote: string | null; // plain text, only when unobtainable
};
/** total: rows matching the filters. */
export type AdvisorPage = { items: AdvisorRow[]; total: number };

export type IncompleteGame = {
  id: string;
  name: string;
  platforms: ("PS4" | "PS5")[];
  coverSrc: string;
  coverIsIcon: boolean;
  coverTileBg: string | null;
  progress: number; // the PSN progress of the game, whatever the settings
  rank: GameRank;
  left: number; // trophies left under the scope
  unobtainable: { label: string; note: string | null } | null; // only when counted unobtainable trophies remain
};

export function advisorScope(s: Pick<Settings, "hideZero" | "advisorHideUnobtainable" | "advisorDlc">): AdvisorScope {
  return { hideZero: s.hideZero, hideUnobtainable: s.advisorHideUnobtainable, dlc: s.advisorDlc };
}

/** The trophies the Advisor counts: the list, its total, countAdvisorTrophies and the column all use it. */
function scopeWhere(scope: AdvisorScope): SQL | undefined {
  const conds: SQL[] = [eq(trophies.earned, false), eq(titles.hidden, false)];
  if (scope.hideZero) conds.push(ne(titles.progress, 0));
  if (scope.hideUnobtainable) conds.push(eq(trophies.unobtainable, false));
  if (scope.dlc === "hide") conds.push(eq(trophies.groupId, "default"));
  if (scope.dlc === "only") conds.push(ne(trophies.groupId, "default"));
  return and(...conds);
}

/** Ties go by game name, list id, then trophy order, in both directions: a total order, so pages never overlap. */
function orderFor(query: AdvisorQuery): SQL[] {
  const dir = query.order === "asc" ? sql`asc` : sql`desc`;
  const primary =
    query.sort === "alphabetical"
      ? sql`${sortName(trophies.name)} ${dir}`
      : sql`${trophies.earnedRate} ${dir} nulls last`;
  return [primary, sql`${sortName(titles.name)} asc`, sql`${trophies.titleId} collate "C" asc`, sql`${trophies.trophyId} asc`];
}

/** Trophies the Advisor counts under `scope`, whatever the sort and the filters. */
export async function countAdvisorTrophies(db: Db, scope: AdvisorScope): Promise<number> {
  return countTrophiesWhere(db, scopeWhere(scope));
}

export async function queryAdvisor(
  db: Db,
  query: AdvisorQuery,
  scope: AdvisorScope,
  paging: { offset: number; limit: number },
): Promise<AdvisorPage> {
  const where = and(scopeWhere(scope), trophyFilters(query));
  const [rows, total, imageMap, siblings] = await Promise.all([
    db
      .select({
        titleId: trophies.titleId,
        trophyId: trophies.trophyId,
        name: trophies.name,
        detail: trophies.detail,
        iconUrl: trophies.iconUrl,
        type: trophies.type,
        earnedRate: trophies.earnedRate,
        progress: trophies.progress,
        progressTarget: trophies.progressTarget,
        unobtainable: trophies.unobtainable,
        gameName: titles.name,
        platforms: titles.platforms,
        unobtainableNote: titles.unobtainableNote,
        dlc: trophyGroups.name,
      })
      .from(trophies)
      .innerJoin(titles, ofTitle)
      .leftJoin(
        trophyGroups,
        and(
          eq(trophyGroups.titleId, trophies.titleId),
          eq(trophyGroups.groupId, trophies.groupId),
          ne(trophies.groupId, "default"),
        ),
      )
      .where(where)
      .orderBy(...orderFor(query))
      .limit(paging.limit)
      .offset(paging.offset),
    countTrophiesWhere(db, where),
    loadImageMap(db),
    loadSiblingIndex(db),
  ]);

  const imageOf = gameImages(siblings, imageMap);
  const items = rows.map((r): AdvisorRow => {
    const rate = r.earnedRate == null ? null : Number(r.earnedRate);
    return {
      key: `${r.titleId}:${r.trophyId}`,
      name: r.name,
      detail: r.detail ?? "",
      iconSrc: mediaSrc(r.iconUrl, imageMap),
      type: r.type,
      gameId: r.titleId,
      gameName: r.gameName,
      ...imageOf(r.titleId),
      dlc: r.dlc,
      platforms: (["PS4", "PS5"] as const).filter((p) => r.platforms.includes(p)),
      counter: r.progressTarget != null && r.progress != null ? formatCounter(r.progress, r.progressTarget) : null,
      ratePct: rate == null ? null : formatPercent(rate),
      tier: rate == null ? null : rarityTier(rate),
      unobtainable: r.unobtainable,
      unobtainableNote: r.unobtainable ? notePlainText(r.unobtainableNote) : null,
    };
  });
  return { items, total };
}

/** The column (17.7): games with trophies left under `scope`, most left first; the sort and the filters do not apply. */
export async function getIncompleteGames(db: Db, scope: AdvisorScope): Promise<IncompleteGame[]> {
  const [counts, imageMap, siblings] = await Promise.all([
    db
      .select({
        id: titles.npCommunicationId,
        left: sql<number>`count(*)::int`,
        unobtainable: sql<number>`(count(*) filter (where ${trophies.unobtainable}))::int`,
      })
      .from(trophies)
      .innerJoin(titles, ofTitle)
      .where(scopeWhere(scope))
      .groupBy(titles.npCommunicationId)
      .orderBy(sql`count(*) desc`, sortName(titles.name), sql`${titles.npCommunicationId} collate "C"`),
    loadImageMap(db),
    loadSiblingIndex(db),
  ]);
  const titleById = new Map([...siblings.values()].flat().map((t) => [t.npCommunicationId, t]));

  const games: IncompleteGame[] = [];
  for (const c of counts) {
    // A title hidden between the two reads is missing from the index: skipped.
    const title = titleById.get(c.id);
    if (!title) continue;
    const row = toGameRow(title, imageMap, siblings);
    games.push({
      id: row.id,
      name: row.name,
      platforms: row.platforms,
      coverSrc: row.coverSrc,
      coverIsIcon: row.coverIsIcon,
      coverTileBg: row.coverTileBg,
      progress: row.progress,
      rank: row.rank,
      left: c.left,
      unobtainable:
        c.unobtainable > 0
          ? { label: unobtainableLabel(c.unobtainable, row.definedTotal), note: notePlainText(title.unobtainableNote) }
          : null,
    });
  }
  return games;
}
