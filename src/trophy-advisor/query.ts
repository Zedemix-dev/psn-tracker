import type { AdvisorDlc } from "@/src/db/schema";
import { pick } from "@/src/lib/pick";
import {
  LOG_ORDERS,
  LOG_PLATFORMS,
  LOG_RARITIES,
  LOG_TYPES,
  type LogOrder,
  type LogPlatform,
  type LogRarity,
  type LogType,
} from "@/src/trophy-log/query";

export const ADVISOR_SORTS = ["rarity", "alphabetical"] as const;
export type AdvisorSort = (typeof ADVISOR_SORTS)[number];
export type AdvisorQuery = {
  sort: AdvisorSort;
  order: LogOrder;
  platform: LogPlatform;
  rarity: LogRarity;
  type: LogType;
};

export const DEFAULT_ADVISOR_QUERY: AdvisorQuery = {
  sort: "rarity",
  order: "desc",
  platform: "all",
  rarity: "all",
  type: "all",
};
export const ADVISOR_SHOW_ALL_SLOT_ID = "trophy-advisor-show-all";

const NATURAL_ORDER: Record<AdvisorSort, LogOrder> = { rarity: "desc", alphabetical: "asc" };

const ORDER_LABELS: Record<AdvisorSort, Record<LogOrder, string>> = {
  rarity: { desc: "Most common first", asc: "Rarest first" },
  alphabetical: { asc: "A to Z", desc: "Z to A" },
};

export function naturalOrder(sort: AdvisorSort): LogOrder {
  return NATURAL_ORDER[sort];
}

export function orderLabel(sort: AdvisorSort, order: LogOrder): string {
  return ORDER_LABELS[sort][order];
}

export function parseAdvisorQuery(params: URLSearchParams): AdvisorQuery {
  const sort = pick(ADVISOR_SORTS, params.get("sort"), "rarity");
  return {
    sort,
    order: pick(LOG_ORDERS, params.get("order"), naturalOrder(sort)),
    platform: pick(LOG_PLATFORMS, params.get("platform"), "all"),
    rarity: pick(LOG_RARITIES, params.get("rarity"), "all"),
    type: pick(LOG_TYPES, params.get("type"), "all"),
  };
}

/** Defaults are left out of the address. */
export function advisorQueryParams(query: AdvisorQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.sort !== DEFAULT_ADVISOR_QUERY.sort) params.set("sort", query.sort);
  if (query.order !== naturalOrder(query.sort)) params.set("order", query.order);
  if (query.platform !== "all") params.set("platform", query.platform);
  if (query.rarity !== "all") params.set("rarity", query.rarity);
  if (query.type !== "all") params.set("type", query.type);
  return params;
}

export function withSort(query: AdvisorQuery, sort: AdvisorSort): AdvisorQuery {
  return { ...query, sort, order: naturalOrder(sort) };
}

/** The controls Reset puts back: sort, direction and the three filters. */
export function activeControls(query: AdvisorQuery): number {
  return [
    query.sort !== DEFAULT_ADVISOR_QUERY.sort,
    query.order !== naturalOrder(query.sort),
    query.platform !== "all",
    query.rarity !== "all",
    query.type !== "all",
  ].filter(Boolean).length;
}

/** What the list and the column are restricted to, besides the query (settings 17.6 and 8.7). */
export type AdvisorScope = { hideZero: boolean; hideUnobtainable: boolean; dlc: AdvisorDlc };

/** Changes with the query, the settings and the last sync: remounts the list. */
export function advisorListKey(query: AdvisorQuery, scope: AdvisorScope, lastSuccessAt: unknown): string {
  return `${advisorQueryParams(query)}|${scope.hideZero}|${scope.hideUnobtainable}|${scope.dlc}|${lastSuccessAt}`;
}
