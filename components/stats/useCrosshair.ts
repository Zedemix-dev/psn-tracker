"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import { preventTouchMenu, useChartTip, type MarkHandlers, type TipContent } from "./ChartTip";

/**
 * Vertical line that follows the pointer and snaps to the nearest x of `xs`, with the tooltip of that point.
 * Attach `ref` to the svg and spread `handlers` on its transparent overlay rect.
 */
export function useCrosshair(
  xs: number[],
  tipFor: (i: number) => TipContent,
): {
  ref: RefObject<SVGSVGElement | null>;
  index: number | null;
  handlers: MarkHandlers;
} {
  const tip = useChartTip();
  const ref = useRef<SVGSVGElement | null>(null);
  const [index, setIndex] = useState<number | null>(null);
  useEffect(() => tip.hide, [tip.hide]);

  const onMove = useCallback(
    (e: PointerEvent) => {
      const x = e.clientX - (ref.current?.getBoundingClientRect().left ?? 0);
      let best = 0;
      xs.forEach((v, k) => {
        if (Math.abs(v - x) < Math.abs(xs[best] - x)) best = k;
      });
      setIndex(best);
      tip.show(e, tipFor(best));
    },
    [xs, tipFor, tip],
  );
  const onLeave = useCallback(() => {
    setIndex(null);
    tip.hide();
  }, [tip]);

  return {
    ref,
    index,
    handlers: { onPointerDown: onMove, onPointerMove: onMove, onPointerLeave: onLeave, onPointerCancel: onLeave, onContextMenu: preventTouchMenu },
  };
}
