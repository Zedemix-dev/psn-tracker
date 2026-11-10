"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { saveLogSnapshot, takeLogSnapshot } from "@/components/trophy-log/log-snapshot";
import { TrophyLogRow } from "@/components/trophy-log/TrophyLogRow";
import type { LogPage } from "@/src/trophy-log/load";
import { LOG_SHOW_ALL_SLOT_ID, logQueryParams, type LogQuery } from "@/src/trophy-log/query";

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
  const loaded = items.length;
  const more = loaded < total;
  const { sort, order, platform, rarity, type } = query;

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
        setItems(page.items);
        setTotal(page.total);
      } catch {
        // The first page stays, from the top.
      } finally {
        if (!cancelled) busy.current = false;
      }
    })();
    return () => {
      cancelled = true;
      busy.current = false;
    };
  }, [snapshotKey, sort, order, platform, rarity, type]);

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
        setItems((prev) => {
          const seen = new Set(prev.map((r) => r.key));
          return [...prev, ...page.items.filter((r) => !seen.has(r.key))];
        });
        setTotal(page.total);
      } catch {
        setFailed(true);
      } finally {
        busy.current = false;
        setLoadingAll(false);
      }
    },
    [sort, order, platform, rarity, type, loaded],
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
