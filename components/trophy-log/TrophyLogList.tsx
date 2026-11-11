"use client";

import { memo } from "react";
import { ProgressiveList } from "@/components/ProgressiveList";
import { logPlaces } from "@/components/trophy-log/log-snapshot";
import { TrophyLogRow } from "@/components/trophy-log/TrophyLogRow";
import type { LogPage, LogRow } from "@/src/trophy-log/load";
import { LOG_SHOW_ALL_SLOT_ID, logQueryParams, type LogQuery } from "@/src/trophy-log/query";

export { RENDER_CHUNK as LOG_RENDER_CHUNK } from "@/components/ProgressiveList";

// Rows keep their identity from one chunk to the next, so only the new ones render.
const Row = memo(TrophyLogRow);
const renderRow = (row: LogRow) => <Row row={row} />;

export function TrophyLogList({
  initial,
  query,
  snapshotKey,
  empty,
}: {
  initial: LogPage;
  query: LogQuery;
  /** Identifies the filters, sort and last sync this list was built for. */
  snapshotKey: string;
  /** Shown instead of the list when there is no row. */
  empty: string;
}) {
  return (
    <ProgressiveList
      initial={initial}
      apiPath="/api/trophy-log"
      queryString={logQueryParams(query).toString()}
      snapshotKey={snapshotKey}
      places={logPlaces}
      slotId={LOG_SHOW_ALL_SLOT_ID}
      renderRow={renderRow}
      empty={empty}
    />
  );
}
