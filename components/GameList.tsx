"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameRow } from "@/components/GameRow";
import { gameQueryParams } from "@/components/game-query-string";
import type { GameQuery } from "@/src/games/query";
import type { GameRowData } from "@/src/games/row";

type Page = { items: GameRowData[]; total: number };

export function GameList({ initial, query }: { initial: Page; query: GameQuery }) {
  const [items, setItems] = useState(initial.items);
  const [total, setTotal] = useState(initial.total);
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const loaded = items.length;
  const more = loaded < total;
  const { state, platform, sort, q } = query;

  const loadMore = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setFailed(false);
    try {
      const params = gameQueryParams({ state, platform, sort, q });
      params.set("offset", String(loaded));
      const res = await fetch(`/api/games?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const page: Page = await res.json();
      setItems((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...page.items.filter((r) => !seen.has(r.id))];
      });
      setTotal(page.total);
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
    }
  }, [state, platform, sort, q, loaded]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !more || failed) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void loadMore();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [more, failed, loadMore]);

  return (
    <>
      <div className="stacked">
        {items.map((row) => (
          <GameRow key={row.id} row={row} />
        ))}
      </div>
      {more && (
        <div className="load-more" ref={sentinel}>
          {failed ? (
            <>
              Couldn&apos;t load more games.{" "}
              <button type="button" className="retry" onClick={() => void loadMore()}>
                Retry
              </button>
            </>
          ) : (
            "The next 50 games load as you scroll down"
          )}
        </div>
      )}
    </>
  );
}
