"use client";

import { useRouter } from "next/navigation";
import {
  activeControls,
  DEFAULT_LOG_QUERY,
  logQueryParams,
  naturalOrder,
  orderLabel,
  tierOf,
  withSort,
  type LogPlatform,
  type LogQuery,
  type LogRarity,
  type LogSort,
  type LogType,
} from "@/src/trophy-log/query";

const SORTS: [LogSort, string][] = [
  ["date", "Date earned"],
  ["alphabetical", "Alphabetical"],
  ["rarity", "Rarity"],
];
const PLATFORMS: [LogPlatform, string][] = [
  ["all", "All platforms"],
  ["PS4", "PS4"],
  ["PS5", "PS5"],
];
const RARITIES: [LogRarity, string][] = [
  ["all", "All rarities"],
  ...(["ultra-rare", "very-rare", "rare", "uncommon", "common"] as const).map((r): [LogRarity, string] => [
    r,
    tierOf(r),
  ]),
];
const TYPES: [LogType, string][] = [
  ["all", "All types"],
  ["platinum", "Platinum"],
  ["gold", "Gold"],
  ["silver", "Silver"],
  ["bronze", "Bronze"],
];

const selectClass = (active: boolean) => `select${active ? " on" : ""}`;

export function TrophyLogControls({ query }: { query: LogQuery }) {
  const router = useRouter();

  function go(next: LogQuery) {
    const qs = logQueryParams(next).toString();
    router.replace(qs ? `/trophy-log?${qs}` : "/trophy-log", { scroll: false });
  }

  const active = activeControls(query);
  return (
    <div className="log-tools">
      <select
        className={selectClass(query.sort !== DEFAULT_LOG_QUERY.sort)}
        aria-label="Sort by"
        value={query.sort}
        onChange={(e) => go(withSort(query, e.target.value as LogSort))}
      >
        {SORTS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={`${selectClass(query.order !== naturalOrder(query.sort))} log-dir`}
        title="Reverse the order"
        onClick={() => go({ ...query, order: query.order === "asc" ? "desc" : "asc" })}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 4v16M4.5 16.5 8 20l3.5-3.5" />
            <path d="M16 20V4M12.5 7.5 16 4l3.5 3.5" />
          </g>
        </svg>
        {orderLabel(query.sort, query.order)}
      </button>
      <span className="gap" />
      <select
        className={selectClass(query.platform !== "all")}
        aria-label="Filter by platform"
        value={query.platform}
        onChange={(e) => go({ ...query, platform: e.target.value as LogPlatform })}
      >
        {PLATFORMS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select
        className={selectClass(query.rarity !== "all")}
        aria-label="Filter by rarity"
        value={query.rarity}
        onChange={(e) => go({ ...query, rarity: e.target.value as LogRarity })}
      >
        {RARITIES.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select
        className={selectClass(query.type !== "all")}
        aria-label="Filter by type"
        value={query.type}
        onChange={(e) => go({ ...query, type: e.target.value as LogType })}
      >
        {TYPES.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      {active > 0 && (
        <button type="button" className="log-reset" onClick={() => go(DEFAULT_LOG_QUERY)}>
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Reset ({active})
        </button>
      )}
    </div>
  );
}
