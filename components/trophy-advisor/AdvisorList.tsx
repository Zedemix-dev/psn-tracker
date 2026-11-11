"use client";

import { memo } from "react";
import { ProgressiveList } from "@/components/ProgressiveList";
import { createPlaceStore } from "@/components/place-snapshot";
import { AdvisorRow } from "@/components/trophy-advisor/AdvisorRow";
import type { AdvisorPage, AdvisorRow as AdvisorRowData } from "@/src/trophy-advisor/load";
import { ADVISOR_SHOW_ALL_SLOT_ID, advisorQueryParams, type AdvisorQuery } from "@/src/trophy-advisor/query";

const advisorPlaces = createPlaceStore("trophy-advisor-list", "trophyAdvisorSnapshot");

// Rows keep their identity from one chunk to the next, so only the new ones render.
const Row = memo(AdvisorRow);
const renderRow = (row: AdvisorRowData) => <Row row={row} />;

export function AdvisorList({
  initial,
  query,
  snapshotKey,
  empty,
}: {
  initial: AdvisorPage;
  query: AdvisorQuery;
  /** Identifies the filters, settings and last sync this list was built for. */
  snapshotKey: string;
  /** Shown instead of the list when there is no row. */
  empty: string;
}) {
  return (
    <ProgressiveList
      initial={initial}
      apiPath="/api/trophy-advisor"
      queryString={advisorQueryParams(query).toString()}
      snapshotKey={snapshotKey}
      places={advisorPlaces}
      slotId={ADVISOR_SHOW_ALL_SLOT_ID}
      renderRow={renderRow}
      empty={empty}
    />
  );
}
