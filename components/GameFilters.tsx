"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { gameQueryParams } from "@/components/game-query-string";
import type { GamePlatform, GameQuery, GameSort, GameState } from "@/src/games/query";

const STATES: [GameState, string][] = [
  ["all", "All"],
  ["100", "100%"],
  ["not100", "Not 100%"],
  ["notFinished", "Not 100% or Platinum"],
  ["0", "0%"],
  ["platinum", "Platinum"],
  ["platinumNot100", "Platinum, not 100%"],
];
const PLATFORMS: [GamePlatform, string][] = [
  ["all", "All platforms"],
  ["PS4", "PS4"],
  ["PS5", "PS5"],
];
const SORTS: [GameSort, string][] = [
  ["lastPlayed", "Last played"],
  ["lastTrophy", "Last trophy"],
  ["alphabetical", "Alphabetical"],
  ["percent", "Percent completion"],
  ["timePlayed", "Time played"],
  ["totalTrophies", "Total trophies"],
  ["earnedTrophies", "Earned trophies"],
  ["unearnedTrophies", "Unearned trophies"],
  ["platinumRarity", "Platinum rarity"],
];
const DEBOUNCE_MS = 300;

function Options<T extends string>({ options }: { options: [T, string][] }) {
  return options.map(([value, label]) => (
    <option key={value} value={value}>
      {label}
    </option>
  ));
}

export function GameFilters({ query }: { query: GameQuery }) {
  const router = useRouter();
  const [text, setText] = useState(query.q);
  /** Last search text this component put in the URL, to tell its own navigations from history ones. */
  const pushedQ = useRef<string | null>(null);

  function go(next: Omit<GameQuery, "offset">) {
    const qs = gameQueryParams(next).toString();
    router.replace(qs ? `/?${qs}` : "/", { scroll: false });
  }

  // The URL changed by itself (Back/Forward): show its search text again.
  useEffect(() => {
    if (query.q === pushedQ.current) return;
    pushedQ.current = null;
    setText(query.q);
  }, [query.q]);

  useEffect(() => {
    const q = text.trim();
    if (q === query.q) return;
    const timer = setTimeout(() => {
      pushedQ.current = q;
      go({ ...query, q });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, query]);

  return (
    <div className="games-tools">
      <select
        className="select"
        aria-label="Filter by status"
        value={query.state}
        onChange={(e) => go({ ...query, state: e.target.value as GameState })}
      >
        <Options options={STATES} />
      </select>
      <select
        className="select"
        aria-label="Filter by platform"
        value={query.platform}
        onChange={(e) => go({ ...query, platform: e.target.value as GamePlatform })}
      >
        <Options options={PLATFORMS} />
      </select>
      <select
        className="select"
        aria-label="Sort by"
        value={query.sort}
        onChange={(e) => go({ ...query, sort: e.target.value as GameSort })}
      >
        <Options options={SORTS} />
      </select>
      <label className="search">
        <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
          <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="6.5" />
            <path d="M20 20l-4.2-4.2" />
          </g>
        </svg>
        <input
          type="search"
          placeholder="Search games"
          aria-label="Search games"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
    </div>
  );
}
