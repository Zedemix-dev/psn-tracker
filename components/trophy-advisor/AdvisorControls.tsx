"use client";

import { useRouter } from "next/navigation";
import { DirectionButton, ResetButton, selectClass, TrophyFilterSelects } from "@/components/trophy-log/ControlParts";
import {
  activeControls,
  advisorQueryParams,
  DEFAULT_ADVISOR_QUERY,
  naturalOrder,
  orderLabel,
  withSort,
  type AdvisorQuery,
  type AdvisorSort,
} from "@/src/trophy-advisor/query";

const SORTS: [AdvisorSort, string][] = [
  ["rarity", "Rarity"],
  ["alphabetical", "Alphabetical"],
];

export function AdvisorControls({ query }: { query: AdvisorQuery }) {
  const router = useRouter();

  function go(next: AdvisorQuery) {
    const qs = advisorQueryParams(next).toString();
    router.replace(qs ? `/trophy-advisor?${qs}` : "/trophy-advisor", { scroll: false });
  }

  const active = activeControls(query);
  return (
    <div className="log-tools">
      <select
        className={selectClass(query.sort !== DEFAULT_ADVISOR_QUERY.sort)}
        aria-label="Sort by"
        value={query.sort}
        onChange={(e) => go(withSort(query, e.target.value as AdvisorSort))}
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
      {active > 0 && <ResetButton count={active} onClick={() => go(DEFAULT_ADVISOR_QUERY)} />}
    </div>
  );
}
