"use client";

import { useRouter } from "next/navigation";
import { DirectionButton, ResetButton, selectClass, TrophyFilterSelects } from "@/components/trophy-log/ControlParts";
import {
  activeControls,
  DEFAULT_LOG_QUERY,
  logQueryParams,
  naturalOrder,
  orderLabel,
  withSort,
  type LogQuery,
  type LogSort,
} from "@/src/trophy-log/query";

const SORTS: [LogSort, string][] = [
  ["date", "Date earned"],
  ["alphabetical", "Alphabetical"],
  ["rarity", "Rarity"],
];

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
      <DirectionButton
        active={query.order !== naturalOrder(query.sort)}
        label={orderLabel(query.sort, query.order)}
        onClick={() => go({ ...query, order: query.order === "asc" ? "desc" : "asc" })}
      />
      <span className="gap" />
      <TrophyFilterSelects value={query} onChange={(next) => go({ ...query, ...next })} />
      {active > 0 && <ResetButton count={active} onClick={() => go(DEFAULT_LOG_QUERY)} />}
    </div>
  );
}
