"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useChartTip } from "./ChartTip";

type State = { can: boolean; fl: boolean; fr: boolean; drag: boolean };

/**
 * Sideways scrolling without a scrollbar: opens on the right end, fades the cut edges,
 * and lets a mouse drag the content. A finger is left to the browser.
 */
export function useSideScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const tip = useChartTip();
  const [state, setState] = useState<State>({ can: false, fl: false, fr: false, drag: false });
  const pinned = useRef(true);
  const start = useRef<{ x: number; left: number; id: number; moving: boolean } | null>(null);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (pinned.current) el.scrollLeft = el.scrollWidth;
    const can = el.scrollWidth > el.clientWidth + 1;
    const fl = can && el.scrollLeft > 1;
    const fr = can && el.scrollLeft < el.scrollWidth - el.clientWidth - 1;
    setState((s) => (s.can === can && s.fl === fl && s.fr === fr ? s : { ...s, can, fl, fr }));
  }, []);

  // After every render, and whenever the container is resized.
  useLayoutEffect(measure);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    pinned.current = el.scrollLeft >= el.scrollWidth - el.clientWidth - 1;
    measure();
  }, [measure]);

  const onPointerDown = useCallback((e: ReactPointerEvent<T>) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse" || e.button !== 0 || el.scrollWidth <= el.clientWidth + 1) return;
    start.current = { x: e.clientX, left: el.scrollLeft, id: e.pointerId, moving: false };
  }, []);

  const end = useCallback(() => {
    const el = ref.current;
    const s = start.current;
    start.current = null;
    if (!s) return;
    if (el?.hasPointerCapture?.(s.id)) el.releasePointerCapture?.(s.id);
    setState((p) => (p.drag ? { ...p, drag: false } : p));
  }, []);

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<T>) => {
      const el = ref.current;
      const s = start.current;
      if (!el || !s) return;
      // The button was released outside the element, before any capture: the drag is over.
      if (e.buttons === 0) return end();
      const dx = e.clientX - s.x;
      if (!s.moving) {
        if (Math.abs(dx) <= 3) return;
        s.moving = true;
        el.setPointerCapture?.(s.id);
        tip.hide();
        setState((p) => (p.drag ? p : { ...p, drag: true }));
      }
      el.scrollLeft = s.left - dx;
    },
    [tip, end],
  );

  const className = ["st-side", state.can && "can", state.drag && "drag", state.fl && "fl", state.fr && "fr"].filter(Boolean).join(" ");

  return { ref, className, handlers: { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end, onScroll } };
}
