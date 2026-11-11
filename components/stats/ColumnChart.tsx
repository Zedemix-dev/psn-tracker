"use client";

import { useEffect } from "react";
import { formatInt, niceScale } from "@/src/stats/chart-geometry";
import { ACCENT, GRID } from "./colors";
import { tipHandlers, useChartTip } from "./ChartTip";
import { useSideScroll } from "./useSideScroll";
import { useWidth } from "./useWidth";

type Props = {
  labels: string[];
  values: number[];
  height: number;
  ariaLabel: string;
  unit: [one: string, many: string];
  titleOf: (i: number) => string;
  labelEvery?: { every: number; belowWidth: number };
  /** Narrowest slot per column: below it the chart scrolls sideways instead of squeezing the columns. */
  minSlot?: number;
};

const M = { t: 18, r: 4, b: 24, l: 44 };
const PAD = 32; // .st-chart horizontal padding
const PAD_BOTTOM = 12; // .st-chart bottom padding (border-box): the drawn chart is height + 12 tall

export function ColumnChart({ labels, values, height, ariaLabel, unit, titleOf, labelEvery, minSlot }: Props) {
  const [ref, measured] = useWidth<HTMLDivElement>();
  const tip = useChartTip();
  const side = useSideScroll<HTMLDivElement>();
  useEffect(() => tip.hide, [tip.hide]);

  const w = measured === null ? null : Math.max(measured - PAD, 0);
  let svg = null;
  if (w !== null && values.length > 0) {
    const sc = niceScale(Math.max(0, ...values), 4);
    const plot = (w - M.l - M.r) / values.length;
    const slot = minSlot === undefined ? plot : Math.max(minSlot, plot);
    const scrolling = minSlot !== undefined;
    const x0 = scrolling ? 0 : M.l; // the scrolling SVG has no axis margin: the axis is its own SVG
    const svgW = scrolling ? slot * values.length + M.r : w;
    const bw = Math.max(Math.min(24, slot - 6), 1);
    const Y = (v: number) => M.t + (height - M.t - M.b) * (1 - v / sc.max);
    const base = Y(0);
    let pk = 0;
    values.forEach((v, i) => {
      if (v > values[pk]) pk = i;
    });
    const every = labelEvery && w < labelEvery.belowWidth ? labelEvery.every : 1;
    const ticks = Math.round(sc.max / sc.step);

    const axisLabel = (k: number) => (
      <text x={M.l - 8} y={Y(k * sc.step) + 4} textAnchor="end">
        {formatInt(k * sc.step)}
      </text>
    );
    const ticksList = Array.from({ length: ticks + 1 }, (_, k) => k);

    const plotSvg = (
      <svg width={svgW} height={height} role="img" aria-label={ariaLabel}>
        {ticksList.map((k) => {
          const y = Y(k * sc.step);
          return (
            <g key={k}>
              <line x1={x0} x2={svgW - M.r} y1={y} y2={y} stroke={GRID} />
              {!scrolling && axisLabel(k)}
            </g>
          );
        })}
        {values.map((v, i) => {
          const x = x0 + slot * i + (slot - bw) / 2;
          const y = Y(v);
          const r = Math.min(4, base - y, bw / 2);
          return (
            <g key={i}>
              <path
                className="col"
                d={`M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + bw - r}Q${x + bw},${y} ${x + bw},${y + r}V${base}Z`}
                fill={ACCENT}
              />
              <rect
                className="hit"
                x={x0 + slot * i}
                y={M.t}
                width={slot}
                height={Math.max(base - M.t, 0)}
                fill="transparent"
                {...tipHandlers(tip, () => ({
                  title: titleOf(i),
                  rows: [{ color: ACCENT, value: formatInt(values[i]), label: values[i] === 1 ? unit[0] : unit[1] }],
                }))}
              />
              {i % every === 0 && (
                <text x={x0 + slot * i + slot / 2} y={height - 6} textAnchor="middle">
                  {labels[i]}
                </text>
              )}
            </g>
          );
        })}
        <text className="peak" x={x0 + slot * pk + slot / 2} y={Y(values[pk]) - 6} textAnchor="middle">
          {formatInt(values[pk])}
        </text>
      </svg>
    );

    svg = scrolling ? (
      <div className="st-yc">
        <svg className="st-yaxis" width={M.l} height={height} aria-hidden="true">
          {ticksList.map((k) => (
            <g key={k}>{axisLabel(k)}</g>
          ))}
        </svg>
        <div ref={side.ref} className={side.className} {...side.handlers}>
          {plotSvg}
        </div>
      </div>
    ) : (
      plotSvg
    );
  }

  return (
    <div ref={ref} className="st-chart" style={{ minHeight: height + PAD_BOTTOM }}>
      {svg}
    </div>
  );
}
