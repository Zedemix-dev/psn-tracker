"use client";

import { memo } from "react";
import { GameRow } from "@/components/GameRow";
import { SHOW_ALL_SLOT_ID, gameQueryParams } from "@/components/game-query-string";
import { createPlaceStore } from "@/components/place-snapshot";
import { ProgressiveList } from "@/components/ProgressiveList";
import type { GameQuery } from "@/src/games/query";
import type { GameRowData } from "@/src/games/row";

/** Where the list was left when a game was opened, and its rows (keepRows), for Back. */
export const gamePlaces = createPlaceStore("games-list", "gamesSnapshot");

// Rows keep their identity from one chunk to the next, so only the new ones render.
const Row = memo(GameRow);
const renderRow = (row: GameRowData) => <Row row={row} />;
const gameKey = (row: GameRowData) => row.id;

export function GameList({
  initial,
  query,
  snapshotKey,
  empty = "No games match these filters.",
}: {
  initial: { items: GameRowData[]; total: number };
  query: GameQuery;
  /** Identifies the filters, sort, search and last sync this list was built for. */
  snapshotKey: string;
  /** Shown instead of the list when no game matches. */
  empty?: string;
}) {
  return (
    <ProgressiveList
      initial={initial}
      apiPath="/api/games"
      queryString={gameQueryParams(query).toString()}
      snapshotKey={snapshotKey}
      places={gamePlaces}
      slotId={SHOW_ALL_SLOT_ID}
      renderRow={renderRow}
      rowKey={gameKey}
      rowSelector="a.game[data-key]"
      noun="games"
      className="stacked"
      keepRows
      empty={empty}
    />
  );
}
