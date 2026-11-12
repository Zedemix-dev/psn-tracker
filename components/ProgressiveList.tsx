"use client";

import { createPortal } from "react-dom";
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { PlaceSnapshot, PlaceStore } from "@/components/place-snapshot";

/** Rows added to the page per animation frame when a big result arrives (about 80 ms each). */
export const RENDER_CHUNK = 300;

const findRow = (key: string) =>
  document.querySelector<HTMLElement>(`.log-row[data-key="${key.replace(/["\\]/g, "\\$&")}"]`);

const SETTLE_INPUTS = ["wheel", "touchstart", "keydown", "pointerdown"] as const;

/**
 * Rows near the viewport are measured for real only in the rendering update after our scroll
 * (content-visibility), and the ones above the saved row grow: it drifts. Put the row back at its
 * offset once per frame until it stays within 1 px for 3 frames in a row (30 frames at most), or
 * until the user takes over. Returns the stop function.
 */
function settleOnRow(
  key: string,
  offset: number,
  frame: { current: number | null },
  self: { current: (() => void) | null },
): () => void {
  let stable = 0;
  let frames = 0;
  const stop = () => {
    for (const type of SETTLE_INPUTS) window.removeEventListener(type, stop);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    if (self.current === stop) self.current = null;
  };
  for (const type of SETTLE_INPUTS) window.addEventListener(type, stop, { passive: true });
  const tick = () => {
    frame.current = null;
    frames++;
    const el = findRow(key);
    if (el) {
      const top = el.getBoundingClientRect().top;
      if (Math.abs(top - offset) > 1) {
        stable = 0;
        window.scrollTo(0, top + window.scrollY - offset);
      } else stable++;
    }
    if (stable >= 3 || frames >= 30) stop();
    else frame.current = requestAnimationFrame(tick);
  };
  frame.current = requestAnimationFrame(tick);
  return stop;
}

/** The first row whose bottom is below the viewport top, and its offset from that top. */
function topRow(): { key: string; offset: number } | null {
  const rows = document.querySelectorAll<HTMLElement>(".log-row[data-key]");
  for (const el of rows) {
    const rect = el.getBoundingClientRect();
    if (rect.bottom > 0) return { key: el.dataset.key!, offset: rect.top };
  }
  return null;
}

export function ProgressiveList<T extends { key: string }>({
  initial,
  apiPath,
  queryString,
  snapshotKey,
  places,
  slotId,
  renderRow,
  empty,
}: {
  initial: { items: T[]; total: number };
  /** The endpoint that answers `{ items, total }`. */
  apiPath: string;
  /** The filters only, without offset, limit or all. */
  queryString: string;
  /** Identifies the filters, sort and last sync this list was built for. */
  snapshotKey: string;
  places: PlaceStore;
  /** The id of the element "Show all" is portaled into. */
  slotId: string;
  /** Module-level, with a memoised row: only the new rows render from one chunk to the next.
   *  The row must render a `.log-row[data-key]` element (`findRow` and `topRow` rely on it). */
  renderRow: (row: T) => ReactNode;
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
  const pendingScroll = useRef<Pick<PlaceSnapshot, "scrollY" | "anchorKey" | "anchorOffset"> | null>(null);
  // Rows received but not rendered yet, one chunk per animation frame (see RENDER_CHUNK).
  const queue = useRef<T[]>([]);
  const chunkFrame = useRef<number | null>(null);
  const scrollFrame = useRef<number | null>(null);
  const stopSettle = useRef<(() => void) | null>(null);
  const alive = useRef(true);
  const loaded = items.length;
  const loadedRows = useRef(loaded);
  const more = loaded < total;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stopSettle.current?.();
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
    const chunk = queue.current.splice(0, RENDER_CHUNK);
    setItems((prev) => {
      const seen = new Set(prev.map((r) => r.key));
      return [...prev, ...chunk.filter((r) => !seen.has(r.key))];
    });
    // eslint-disable-next-line react-hooks/immutability -- pump schedules itself on the next frame; the callback is only called after it is defined
    if (queue.current.length > 0) chunkFrame.current = requestAnimationFrame(pump);
    else finishQueue();
  }, []);

  const enqueue = useCallback(
    (incoming: T[], replace: boolean) => {
      if (replace) {
        setItems(incoming.slice(0, RENDER_CHUNK));
        queue.current = incoming.slice(RENDER_CHUNK);
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the slot is in the server-rendered header: it can only be read after mount, to keep hydration clean
    setSlot(document.getElementById(slotId));
  }, [slotId]);

  // Back from a game page: the browser kept no rows (there can be thousands), only how many were
  // loaded and where the page was. Fetch that many again, then scroll. If it fails, the first page
  // stays where it is. Done after mount, so the server-rendered first page still hydrates cleanly.
  useEffect(() => {
    const snap = places.take(snapshotKey);
    if (!snap) return;
    let cancelled = false;
    busy.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restored after mount on purpose, so the server-rendered first page still hydrates cleanly
    setLoadingAll(true); // "Show all" reads Loading… (disabled) until the rows are back
    (async () => {
      try {
        const params = new URLSearchParams(queryString);
        params.set("offset", "0");
        params.set("limit", String(snap.loaded));
        const res = await fetch(`${apiPath}?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const page: { items: T[]; total: number } = await res.json();
        if (cancelled) return;
        pendingScroll.current = snap;
        setTotal(page.total);
        enqueue(page.items, true);
      } catch {
        // The first page stays, from the top.
        if (!cancelled) {
          busy.current = false;
          setLoadingAll(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      busy.current = false;
      dropQueue();
    };
  }, [snapshotKey, places, apiPath, queryString, enqueue]);

  // A layout effect: the click listener below runs before React would flush a passive one.
  useLayoutEffect(() => {
    loadedRows.current = loaded;
  }, [loaded]);

  // Back: scroll to the saved row (not the saved pixel: rows above it take their real height once
  // rendered). Only once the chunk holding that row is in the DOM; if it never comes, scrollY after
  // the last chunk. Again on the next frame, in case the router's own scroll handling ran between.
  useLayoutEffect(() => {
    const target = pendingScroll.current;
    if (target === null) return;
    const done = queue.current.length === 0;
    const place = () => {
      const el = target.anchorKey !== undefined ? findRow(target.anchorKey) : null;
      if (el && target.anchorOffset !== undefined) {
        return el.getBoundingClientRect().top + window.scrollY - target.anchorOffset;
      }
      return target.anchorKey === undefined ? target.scrollY : null;
    };
    let y = place();
    if (y === null) {
      if (!done) return;
      y = target.scrollY;
    }
    if (target.anchorKey === undefined && !done) {
      // No row saved (older snapshot): wait until the page is tall enough for the pixel.
      if (document.documentElement.scrollHeight - window.innerHeight < y) return;
    }
    pendingScroll.current = null;
    window.scrollTo(0, y);
    const anchorKey = target.anchorKey;
    const anchorOffset = target.anchorOffset;
    if (anchorKey !== undefined && anchorOffset !== undefined && findRow(anchorKey)) {
      stopSettle.current?.();
      stopSettle.current = settleOnRow(anchorKey, anchorOffset, scrollFrame, stopSettle);
      return;
    }
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = null;
      window.scrollTo(0, y);
    });
  }, [items]);

  // On the document, not the list: game links next to the list leave the page too.
  useEffect(() => {
    const rememberPlace = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (e.target instanceof Element && e.target.closest('a[href^="/games/"]')) {
        const top = topRow();
        places.save({
          key: snapshotKey,
          loaded: loadedRows.current,
          scrollY: window.scrollY,
          ...(top ? { anchorKey: top.key, anchorOffset: top.offset } : {}),
        });
      }
    };
    document.addEventListener("click", rememberPlace, true);
    return () => document.removeEventListener("click", rememberPlace, true);
  }, [snapshotKey, places]);

  // One loader for the next page (scrolling, Retry) and for the whole rest (Show all).
  const load = useCallback(
    async (all: boolean) => {
      if (busy.current) return;
      busy.current = true;
      setFailed(false);
      if (all) setLoadingAll(true);
      try {
        const params = new URLSearchParams(queryString);
        params.set("offset", String(loaded));
        if (all) params.set("all", "1");
        const res = await fetch(`${apiPath}?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const page: { items: T[]; total: number } = await res.json();
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
    [apiPath, queryString, loaded, enqueue],
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
      <div>
        {items.map((row) => (
          <Fragment key={row.key}>{renderRow(row)}</Fragment>
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
