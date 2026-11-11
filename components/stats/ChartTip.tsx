"use client";

import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { tipPosition } from "@/src/stats/chart-geometry";

export type TipContent = { title: string; rows: { color?: string; value: string; label: string }[]; note?: string };
type Api = { show(e: { clientX: number; clientY: number; pointerType?: string }, content: TipContent): void; hide(): void };

export type MarkHandlers = {
  onPointerDown: (e: ReactPointerEvent<Element>) => void;
  onPointerMove: (e: ReactPointerEvent<Element>) => void;
  onPointerUp: (e: ReactPointerEvent<Element>) => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
  onContextMenu: (e: ReactMouseEvent) => void;
};

/** A finger's long press opens a context menu that would steal the touch. */
export function preventTouchMenu(e: ReactMouseEvent): void {
  if ((e.nativeEvent as PointerEvent).pointerType === "touch") e.preventDefault();
}

/**
 * Pointer handlers of a hoverable mark. A finger shows the tooltip as it goes down and while it slides;
 * the browser fires leave / cancel when it lifts or when the page takes over to scroll.
 */
export function tipHandlers(tip: Api, content: () => TipContent): MarkHandlers {
  return {
    onPointerDown: (e) => {
      // A touch pointer is captured by the element it went down on: release it so moves reach the mark under the finger.
      const el = e.currentTarget;
      if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture?.(e.pointerId);
      tip.show(e, content());
    },
    onPointerMove: (e) => tip.show(e, content()),
    onPointerUp: (e) => {
      if (e.pointerType === "touch") tip.hide();
    },
    onPointerLeave: tip.hide,
    onPointerCancel: tip.hide,
    onContextMenu: preventTouchMenu,
  };
}

const noop: Api = { show() {}, hide() {} };
const TipContext = createContext<Api>(noop);

export const useChartTip = (): Api => useContext(TipContext);

/** One tooltip for the whole page. Portaled to body: .glass traps position:fixed. */
export function ChartTipProvider({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<{ x: number; y: number; touch: boolean; content: TipContent } | null>(null);
  const el = useRef<HTMLDivElement>(null);

  const show = useCallback<Api["show"]>((e, content) => setTip({ x: e.clientX, y: e.clientY, touch: e.pointerType === "touch", content }), []);
  const hide = useCallback(() => setTip(null), []);
  const api = useMemo(() => ({ show, hide }), [show, hide]);

  useEffect(() => {
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, [hide]);

  useLayoutEffect(() => {
    const node = el.current;
    if (!tip || !node) return;
    const { left, top } = tipPosition(
      { x: tip.x, y: tip.y },
      { w: node.offsetWidth, h: node.offsetHeight },
      { w: window.innerWidth, h: window.innerHeight },
      tip.touch,
    );
    node.style.left = `${Number.isFinite(left) ? left : 0}px`;
    node.style.top = `${Number.isFinite(top) ? top : 0}px`;
  }, [tip]);

  return (
    <TipContext.Provider value={api}>
      {children}
      {tip &&
        createPortal(
          <div ref={el} className="st-tip" style={{ display: "block" }} role="tooltip">
            <div className="h">{tip.content.title}</div>
            {tip.content.rows.map((r, i) => (
              <div className="r" key={i}>
                {r.color && <u style={{ background: r.color }} />}
                <b>{r.value}</b>
                <span>{r.label}</span>
              </div>
            ))}
            {tip.content.note && <div className="h">{tip.content.note}</div>}
          </div>,
          document.body,
        )}
    </TipContext.Provider>
  );
}
