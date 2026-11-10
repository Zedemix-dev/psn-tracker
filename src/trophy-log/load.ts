import { and, eq, ne, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { titles, trophies, trophyGroups, type TrophyType } from "@/src/db/schema";
import { loadSiblingIndex, withSiblings } from "@/src/games/siblings";
import { formatDate, formatPercent, formatTime } from "@/src/lib/format";
import { RARITY_RANGES, rarityTier, type RarityTier } from "@/src/lib/rarity";
import { earnedVisible } from "@/src/stats/trophies";
import { loadImageMap, mediaSrc } from "@/src/sync/images";
import { tierOf, type LogQuery } from "@/src/trophy-log/query";

/** JSON-safe: what one row of the log shows. */
export type LogRow = {
  key: string; // `${titleId}:${trophyId}`
  n: number; // earned number (16.4)
  name: string;
  detail: string;
  iconSrc: string;
  type: TrophyType;
  gameId: string;
  gameName: string;
  gameSrc: string; // the image of the game's row in Games
  gameIsIcon: boolean; // true: the trophy-list icon, shown whole on its tile
  dlc: string | null; // group name, only when groupId ≠ "default"
  platforms: ("PS4" | "PS5")[];
  date: string; // "9 Nov 2026"
  time: string; // "15:46:30"
  ratePct: string | null; // "4.60%"
  tier: RarityTier | null;
  unobtainable: boolean;
};
/** total: rows matching the filters. */
export type LogPage = { items: LogRow[]; total: number };

const ofTitle = eq(trophies.titleId, titles.npCommunicationId);

/** Spec 16.4, the order of compareEarnedOrder (src/lib/earned-order.ts): the number of each earned trophy. */
const earnedNumber = sql<number>`(row_number() over (order by date_trunc('second', ${trophies.earnedAt}), (${trophies.type} = 'platinum'), ${trophies.trophyId}, ${trophies.titleId} collate "C"))::int`;

/** Latin letters with accents and the letter they sort as. lower() only lowercases ASCII under collate "C", so the capitals are listed too. */
const ACCENT_GROUPS: [string, string][] = [
  ["a", "àáâãäåÀÁÂÃÄÅ"],
  ["c", "çÇ"],
  ["e", "èéêëÈÉÊË"],
  ["i", "ìíîïÌÍÎÏ"],
  ["n", "ñÑ"],
  ["o", "òóôõöÒÓÔÕÖ"],
  ["u", "ùúûüÙÚÛÜ"],
  ["y", "ýÿÝ"],
];
const ACCENTED = ACCENT_GROUPS.map(([, from]) => from).join("");
const BASE_LETTERS = ACCENT_GROUPS.map(([to, from]) => to.repeat(from.length)).join("");

/** Spec 16.6: the name without case, accents and leading punctuation or spaces, in code order. */
const nameKey = sql`regexp_replace(translate(lower(${trophies.name}), ${ACCENTED}, ${BASE_LETTERS}), '^[^a-z0-9]+', '') collate "C"`;

function filtersFor(query: LogQuery): SQL | undefined {
  const conds: SQL[] = [];
  if (query.platform !== "all") conds.push(sql`${query.platform} = any(${titles.platforms})`);
  if (query.rarity !== "all") {
    // An unknown rate fails both comparisons: it only shows under All rarities.
    const [min, max] = RARITY_RANGES[tierOf(query.rarity)];
    conds.push(sql`${trophies.earnedRate} >= ${min}`);
    if (max !== null) conds.push(sql`${trophies.earnedRate} < ${max}`);
  }
  if (query.type !== "all") conds.push(eq(trophies.type, query.type));
  return and(...conds);
}

/** Ends with the number, which is unique: a total order, so pages never overlap or skip a row. */
function orderFor(query: LogQuery, n: SQLWrapper): SQL[] {
  const dir = query.order === "asc" ? sql`asc` : sql`desc`;
  const newestFirst = sql`${n} desc`;
  switch (query.sort) {
    case "date":
      return [sql`${n} ${dir}`];
    case "alphabetical":
      return [sql`${nameKey} ${dir}`, newestFirst];
    case "rarity":
      return [sql`${trophies.earnedRate} ${dir} nulls last`, newestFirst];
  }
}

async function countWhere(db: Db, where: SQL | undefined): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(trophies)
    .innerJoin(titles, ofTitle)
    .where(where);
  return row.n;
}

/** Earned, dated trophies of visible titles: the ones the log numbers. */
export async function countLoggedTrophies(db: Db): Promise<number> {
  return countWhere(db, earnedVisible);
}

export async function queryTrophyLog(
  db: Db,
  query: LogQuery,
  paging: { offset: number; limit: number },
): Promise<LogPage> {
  // Numbered before the filters, so a filter or a sort never changes a number.
  const numbered = db.$with("numbered").as(
    db
      .select({ titleId: trophies.titleId, trophyId: trophies.trophyId, n: earnedNumber.as("n") })
      .from(trophies)
      .innerJoin(titles, ofTitle)
      .where(earnedVisible),
  );
  const [rows, total, imageMap, siblings] = await Promise.all([
    db
      .with(numbered)
      .select({
        titleId: trophies.titleId,
        trophyId: trophies.trophyId,
        n: numbered.n,
        name: trophies.name,
        detail: trophies.detail,
        iconUrl: trophies.iconUrl,
        type: trophies.type,
        earnedAt: trophies.earnedAt,
        earnedRate: trophies.earnedRate,
        unobtainable: trophies.unobtainable,
        gameName: titles.name,
        platforms: titles.platforms,
        dlc: trophyGroups.name,
      })
      .from(numbered)
      .innerJoin(trophies, and(eq(trophies.titleId, numbered.titleId), eq(trophies.trophyId, numbered.trophyId)))
      .innerJoin(titles, ofTitle)
      .leftJoin(
        trophyGroups,
        and(
          eq(trophyGroups.titleId, trophies.titleId),
          eq(trophyGroups.groupId, trophies.groupId),
          ne(trophies.groupId, "default"),
        ),
      )
      .where(filtersFor(query))
      .orderBy(...orderFor(query, numbered.n))
      .limit(paging.limit)
      .offset(paging.offset),
    countWhere(db, and(earnedVisible, filtersFor(query))),
    loadImageMap(db),
    loadSiblingIndex(db),
  ]);

  // The game's image, as on its row in Games (toGameRow), worked out once per game.
  const titleById = new Map([...siblings.values()].flat().map((t) => [t.npCommunicationId, t]));
  const games = new Map<string, Pick<LogRow, "gameSrc" | "gameIsIcon" | "platforms">>();
  const gameOf = (r: (typeof rows)[number]) => {
    let game = games.get(r.titleId);
    if (!game) {
      // A title hidden between the two reads is missing from the index: the placeholder.
      const title = titleById.get(r.titleId);
      const info = title && withSiblings(title, siblings);
      game = {
        gameSrc: mediaSrc(info ? (info.coverUrl ?? info.coverFallbackUrl) : null, imageMap),
        gameIsIcon: info ? info.coverIsIcon : false,
        platforms: (["PS4", "PS5"] as const).filter((p) => r.platforms.includes(p)),
      };
      games.set(r.titleId, game);
    }
    return game;
  };

  const items = rows.map((r): LogRow => {
    const rate = r.earnedRate == null ? null : Number(r.earnedRate);
    return {
      key: `${r.titleId}:${r.trophyId}`,
      n: r.n,
      name: r.name,
      detail: r.detail ?? "",
      iconSrc: mediaSrc(r.iconUrl, imageMap),
      type: r.type,
      gameId: r.titleId,
      gameName: r.gameName,
      ...gameOf(r),
      dlc: r.dlc,
      date: formatDate(r.earnedAt!),
      time: formatTime(r.earnedAt!),
      ratePct: rate == null ? null : formatPercent(rate),
      tier: rate == null ? null : rarityTier(rate),
      unobtainable: r.unobtainable,
    };
  });
  return { items, total };
}
