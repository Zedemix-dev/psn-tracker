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
  const [node, setNode] = useState<T | null>(null);
  const ref = useCallback((n: T | null) => setNode(n), []);
  const tip = useChartTip();
  const [state, setState] = useState<State>({ can: false, fl: false, fr: false, drag: false });
  const pinned = useRef(true);
  const size = useRef({ sw: -1, cw: -1 });
  const start = useRef<{ x: number; left: number; id: number; moving: boolean } | null>(null);

  // eslint-disable-next-line react-hooks/immutability -- node is the DOM element held in state: scrollLeft is a DOM write, not a state change
  const measure = useCallback(() => {
    const el = node;
    if (!el) return;
    // Back to the newest end only when the size changed: never in answer to a scroll or a re-render.
    const sw = el.scrollWidth;
    const cw = el.clientWidth;
    // eslint-disable-next-line react-hooks/immutability -- node is the DOM element held in state: scrollLeft is a DOM write, not a state change
    if (pinned.current && (size.current.sw !== sw || size.current.cw !== cw)) el.scrollLeft = sw;
    size.current = { sw, cw };
    const can = sw > cw + 1;
    const fl = can && el.scrollLeft > 1;
    const fr = can && el.scrollLeft < sw - cw - 1;
    setState((s) => (s.can === can && s.fl === fl && s.fr === fr ? s : { ...s, can, fl, fr }));
  }, [node]);

  // After every render, and whenever the container is resized.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- measures the DOM after every render, as a layout effect must
  useLayoutEffect(measure);
  useEffect(() => {
    if (!node || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, [node, measure]);

  // eslint-disable-next-line react-hooks/immutability -- node is the DOM element held in state: it calls measure, which writes scrollLeft
  const onScroll = useCallback(() => {
    if (!node) return;
    pinned.current = node.scrollLeft >= node.scrollWidth - node.clientWidth - 1;
    measure();
  }, [node, measure]);

  const onPointerDown = useCallback((e: ReactPointerEvent<T>) => {
    const el = node;
    if (!el || e.pointerType !== "mouse" || e.button !== 0 || el.scrollWidth <= el.clientWidth + 1) return;
    start.current = { x: e.clientX, left: el.scrollLeft, id: e.pointerId, moving: false };
  }, [node]);

  const end = useCallback(() => {
    const el = node;
    const s = start.current;
    start.current = null;
    if (!s) return;
    if (el?.hasPointerCapture?.(s.id)) el.releasePointerCapture?.(s.id);
    setState((p) => (p.drag ? { ...p, drag: false } : p));
  }, [node]);

  const onPointerMove = useCallback(
    // eslint-disable-next-line react-hooks/immutability -- node is the DOM element held in state: scrollLeft is a DOM write, not a state change
    (e: ReactPointerEvent<T>) => {
      const el = node;
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
      // eslint-disable-next-line react-hooks/immutability -- node is the DOM element held in state: scrollLeft is a DOM write, not a state change
      el.scrollLeft = s.left - dx;
    },
    [node, tip, end],
  );

  const className = ["st-side", state.can && "can", state.drag && "drag", state.fl && "fl", state.fr && "fr"].filter(Boolean).join(" ");

  return { ref, className, handlers: { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end, onScroll } };
}
