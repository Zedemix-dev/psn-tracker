import { formatInt } from "@/src/lib/format";
import type { RarityTier } from "@/src/lib/rarity";

export const LOG_SORTS = ["date", "alphabetical", "rarity"] as const;
export const LOG_ORDERS = ["desc", "asc"] as const;
export const LOG_PLATFORMS = ["all", "PS4", "PS5"] as const;
export const LOG_RARITIES = ["all", "ultra-rare", "very-rare", "rare", "uncommon", "common"] as const;
export const LOG_TYPES = ["all", "platinum", "gold", "silver", "bronze"] as const;
export type LogSort = (typeof LOG_SORTS)[number];
export type LogOrder = (typeof LOG_ORDERS)[number];
export type LogPlatform = (typeof LOG_PLATFORMS)[number];
export type LogRarity = (typeof LOG_RARITIES)[number];
export type LogType = (typeof LOG_TYPES)[number];
export type LogQuery = { sort: LogSort; order: LogOrder; platform: LogPlatform; rarity: LogRarity; type: LogType };

export const DEFAULT_LOG_QUERY: LogQuery = { sort: "date", order: "desc", platform: "all", rarity: "all", type: "all" };
export const LOG_PAGE_SIZE = 50;
/** "Show all" cap. */
export const LOG_MAX = 100_000;
export const LOG_SHOW_ALL_SLOT_ID = "trophy-log-show-all";

const NATURAL_ORDER: Record<LogSort, LogOrder> = { date: "desc", alphabetical: "asc", rarity: "asc" };

const ORDER_LABELS: Record<LogSort, Record<LogOrder, string>> = {
  date: { desc: "Newest first", asc: "Oldest first" },
  alphabetical: { asc: "A to Z", desc: "Z to A" },
  rarity: { asc: "Rarest first", desc: "Most common first" },
};

const TIERS: Record<Exclude<LogRarity, "all">, RarityTier> = {
  "ultra-rare": "Ultra rare",
  "very-rare": "Very rare",
  rare: "Rare",
  uncommon: "Uncommon",
  common: "Common",
};

function pick<T extends string>(allowed: readonly T[], value: string | null, fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function naturalOrder(sort: LogSort): LogOrder {
  return NATURAL_ORDER[sort];
}

export function orderLabel(sort: LogSort, order: LogOrder): string {
  return ORDER_LABELS[sort][order];
}

export function tierOf(rarity: Exclude<LogRarity, "all">): RarityTier {
  return TIERS[rarity];
}

export function parseLogQuery(params: URLSearchParams): LogQuery {
  const sort = pick(LOG_SORTS, params.get("sort"), "date");
  return {
    sort,
    order: pick(LOG_ORDERS, params.get("order"), naturalOrder(sort)),
    platform: pick(LOG_PLATFORMS, params.get("platform"), "all"),
    rarity: pick(LOG_RARITIES, params.get("rarity"), "all"),
    type: pick(LOG_TYPES, params.get("type"), "all"),
  };
}

export function logQueryParams(query: LogQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.sort !== "date") params.set("sort", query.sort);
  if (query.order !== naturalOrder(query.sort)) params.set("order", query.order);
  if (query.platform !== "all") params.set("platform", query.platform);
  if (query.rarity !== "all") params.set("rarity", query.rarity);
  if (query.type !== "all") params.set("type", query.type);
  return params;
}

export function withSort(query: LogQuery, sort: LogSort): LogQuery {
  return { ...query, sort, order: naturalOrder(sort) };
}

export function isFiltered(query: LogQuery): boolean {
  return query.platform !== "all" || query.rarity !== "all" || query.type !== "all";
}

export function activeControls(query: LogQuery): number {
  return [
    query.sort !== "date",
    query.order !== naturalOrder(query.sort),
    query.platform !== "all",
    query.rarity !== "all",
    query.type !== "all",
  ].filter(Boolean).length;
}

function parseCount(value: string | null): number | null {
  return value !== null && /^\d+$/.test(value) ? Number(value) : null;
}

/** Lenient: a bad offset is 0, a bad or out-of-range limit is one page; `all=1` lifts the limit to LOG_MAX. */
export function parsePaging(params: URLSearchParams): { offset: number; limit: number } {
  const offset = parseCount(params.get("offset")) ?? 0;
  if (params.get("all") === "1") return { offset, limit: LOG_MAX };
  const limit = parseCount(params.get("limit"));
  return { offset, limit: limit !== null && limit >= 1 && limit <= LOG_MAX ? limit : LOG_PAGE_SIZE };
}

export function shownText(overall: number, matching: number, filtered: boolean): string {
  const noun = (n: number) => (n === 1 ? "trophy" : "trophies");
  return filtered
    ? `${formatInt(matching)} of ${formatInt(overall)} ${noun(overall)} match`
    : `${formatInt(overall)} ${noun(overall)}`;
}
