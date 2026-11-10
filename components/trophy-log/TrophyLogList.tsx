"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { saveLogSnapshot, takeLogSnapshot } from "@/components/trophy-log/log-snapshot";
import { TrophyLogRow } from "@/components/trophy-log/TrophyLogRow";
import type { LogPage, LogRow } from "@/src/trophy-log/load";
import { LOG_SHOW_ALL_SLOT_ID, logQueryParams, type LogQuery } from "@/src/trophy-log/query";

/** Rows added to the page per animation frame when a big result arrives (about 80 ms each). */
export const LOG_RENDER_CHUNK = 300;

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
  const [items, setItems] = useState(initial.items);
  const [total, setTotal] = useState(initial.total);
  const [failed, setFailed] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const busy = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const pendingScroll = useRef<number | null>(null);
  // Rows received but not rendered yet, one chunk per animation frame (see LOG_RENDER_CHUNK).
  const queue = useRef<LogRow[]>([]);
  const chunkFrame = useRef<number | null>(null);
  const scrollFrame = useRef<number | null>(null);
  const alive = useRef(true);
  const loaded = items.length;
  const more = loaded < total;
  const { sort, order, platform, rarity, type } = query;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      queue.current = [];
      if (chunkFrame.current !== null) cancelAnimationFrame(chunkFrame.current);
      if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
      chunkFrame.current = null;
      scrollFrame.current = null;
    };
  }, []);

  const dropQueue = () => {
    queue.current = [];
    if (chunkFrame.current !== null) cancelAnimationFrame(chunkFrame.current);
    chunkFrame.current = null;
  };

  const finishQueue = () => {
    busy.current = false;
    setLoadingAll(false);
  };

  // One chunk now, then one per frame until the queue is empty. busy stays true meanwhile.
  const pump = useCallback(() => {
    chunkFrame.current = null;
    const chunk = queue.current.splice(0, LOG_RENDER_CHUNK);
    setItems((prev) => {
      const seen = new Set(prev.map((r) => r.key));
      return [...prev, ...chunk.filter((r) => !seen.has(r.key))];
    });
    if (queue.current.length > 0) chunkFrame.current = requestAnimationFrame(pump);
    else finishQueue();
  }, []);

  const enqueue = useCallback(
    (incoming: LogRow[], replace: boolean) => {
      if (replace) {
        setItems(incoming.slice(0, LOG_RENDER_CHUNK));
        queue.current = incoming.slice(LOG_RENDER_CHUNK);
        if (queue.current.length > 0) chunkFrame.current = requestAnimationFrame(pump);
        else finishQueue();
        return;
      }
      queue.current = incoming;
      pump();
    },
    [pump],
  );

  // The "Show all" slot lives in the server-rendered header; look it up once mounted.
  useEffect(() => {
    setSlot(document.getElementById(LOG_SHOW_ALL_SLOT_ID));
  }, []);

  // Back from a game page: the browser kept no rows (there can be thousands), only how many were
  // loaded and where the page was. Fetch that many again, then scroll. If it fails, the first page
  // stays where it is. Done after mount, so the server-rendered first page still hydrates cleanly.
  useEffect(() => {
    const snap = takeLogSnapshot(snapshotKey);
    if (!snap) return;
    let cancelled = false;
    busy.current = true;
    (async () => {
      try {
        const params = logQueryParams({ sort, order, platform, rarity, type });
        params.set("offset", "0");
        params.set("limit", String(snap.loaded));
        const res = await fetch(`/api/trophy-log?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const page: LogPage = await res.json();
        if (cancelled) return;
        pendingScroll.current = snap.scrollY;
        setTotal(page.total);
        enqueue(page.items, true);
      } catch {
        // The first page stays, from the top.
        if (!cancelled) busy.current = false;
      }
    })();
    return () => {
      cancelled = true;
      busy.current = false;
      dropQueue();
    };
  }, [snapshotKey, sort, order, platform, rarity, type, enqueue]);

  // Scroll as soon as the restored rows make the page tall enough to reach the saved place, or
  // after the last chunk. Again on the next frame, in case the router's own scroll handling ran
  // in between.
  useLayoutEffect(() => {
    const y = pendingScroll.current;
    if (y === null) return;
    const reachable = document.documentElement.scrollHeight - window.innerHeight >= y;
    if (queue.current.length > 0 && !reachable) return;
    pendingScroll.current = null;
    window.scrollTo(0, y);
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = null;
      window.scrollTo(0, y);
    });
  }, [items]);

  const rememberPlace = (e: React.MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if ((e.target as HTMLElement).closest('a[href^="/games/"]')) {
      saveLogSnapshot({ key: snapshotKey, loaded: items.length, scrollY: window.scrollY });
    }
  };

  // One loader for the next page (scrolling, Retry) and for the whole rest (Show all).
  const load = useCallback(
    async (all: boolean) => {
      if (busy.current) return;
      busy.current = true;
      setFailed(false);
      if (all) setLoadingAll(true);
      try {
        const params = logQueryParams({ sort, order, platform, rarity, type });
        params.set("offset", String(loaded));
        if (all) params.set("all", "1");
        const res = await fetch(`/api/trophy-log?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const page: LogPage = await res.json();
        if (!alive.current) return;
        setTotal(page.total);
        enqueue(page.items, false);
      } catch {
        if (!alive.current) return;
        setFailed(true);
        busy.current = false;
        setLoadingAll(false);
      }
    },
    [sort, order, platform, rarity, type, loaded, enqueue],
  );
  const loadMore = useCallback(() => load(false), [load]);

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
      {more &&
        slot &&
        createPortal(
          <button type="button" className="show-all" disabled={loadingAll} onClick={() => void load(true)}>
            {loadingAll ? "Loading…" : "Show all"}
          </button>,
          slot,
        )}
      {items.length === 0 && !more && <p className="empty">{empty}</p>}
      <div onClickCapture={rememberPlace}>
        {items.map((row) => (
          <TrophyLogRow key={row.key} row={row} />
        ))}
      </div>
      {more && (
        <div className="load-more" ref={sentinel}>
          {failed ? (
            <>
              Couldn&apos;t load more trophies.{" "}
              <button type="button" className="retry" onClick={() => void loadMore()}>
                Retry
              </button>
            </>
          ) : (
            "The next 50 trophies load as you scroll down"
          )}
        </div>
      )}
    </>
  );
}
