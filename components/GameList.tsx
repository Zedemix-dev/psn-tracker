"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { GameRow } from "@/components/GameRow";
import { gameQueryParams } from "@/components/game-query-string";
import { saveListSnapshot, takeListSnapshot } from "@/components/list-snapshot";
import type { GameQuery } from "@/src/games/query";
import type { GameRowData } from "@/src/games/row";

type Page = { items: GameRowData[]; total: number };

export function GameList({
  initial,
  query,
  snapshotKey,
  empty = "No games match these filters.",
}: {
  initial: Page;
  query: GameQuery;
  /** Identifies the filters, sort, search and last sync this list was built for. */
  snapshotKey: string;
  /** Shown instead of the list when no game matches. */
  empty?: string;
}) {
  const [items, setItems] = useState(initial.items);
  const [total, setTotal] = useState(initial.total);
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const pendingScroll = useRef<number | null>(null);
  const loaded = items.length;
  const more = loaded < total;
  const { state, platform, sort, q } = query;

  // Back from a game page: put the loaded rows and the scroll position back. Done after mount, so
  // the server-rendered first page still hydrates cleanly.
  useEffect(() => {
    const snap = takeListSnapshot(snapshotKey);
    if (!snap) return;
    pendingScroll.current = snap.scrollY;
    setItems(snap.items);
    setTotal(snap.total);
  }, [snapshotKey]);

  // Once the restored rows are in the DOM (the page is tall enough), scroll. Again on the next
  // frame, in case the router's own scroll handling ran in between.
  useLayoutEffect(() => {
    const y = pendingScroll.current;
    if (y === null) return;
    pendingScroll.current = null;
    window.scrollTo(0, y);
    const frame = requestAnimationFrame(() => window.scrollTo(0, y));
    return () => cancelAnimationFrame(frame);
  }, [items]);

  const rememberPlace = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("a.game")) {
      saveListSnapshot({ key: snapshotKey, items, total, scrollY: window.scrollY });
    }
  };

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
    // The root reaches far above the viewport: jumping to the page bottom (End key, scrollbar
    // drag) can leave the footer above the screen without ever crossing it, and that must load
    // too. 600 px below starts the next page a little before the footer shows.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { rootMargin: "100000px 0px 600px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [more, failed, loadMore]);

  return (
    <>
      {items.length === 0 && !more && <p className="empty">{empty}</p>}
      <div className="stacked" onClickCapture={rememberPlace}>
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
