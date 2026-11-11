"use client";

import { useEffect } from "react";
import { formatInt, niceScale } from "@/src/stats/chart-geometry";
import { ACCENT, GRID } from "./colors";
import { useChartTip } from "./ChartTip";
import { useWidth } from "./useWidth";

type Props = {
  labels: string[];
  values: number[];
  height: number;
  ariaLabel: string;
  unit: string;
  titleOf: (i: number) => string;
  labelEvery?: { every: number; belowWidth: number };
};

const M = { t: 18, r: 4, b: 24, l: 44 };
const PAD = 32; // .st-chart horizontal padding

export function ColumnChart({ labels, values, height, ariaLabel, unit, titleOf, labelEvery }: Props) {
  const [ref, measured] = useWidth<HTMLDivElement>();
  const tip = useChartTip();
  useEffect(() => tip.hide, [tip.hide]);

  const w = measured === null ? null : Math.max(measured - PAD, 0);
  let svg = null;
  if (w !== null && values.length > 0) {
    const sc = niceScale(Math.max(0, ...values), 4);
    const slot = (w - M.l - M.r) / values.length;
    const bw = Math.max(Math.min(24, slot - 6), 1);
    const Y = (v: number) => M.t + (height - M.t - M.b) * (1 - v / sc.max);
    const base = Y(0);
    let pk = 0;
    values.forEach((v, i) => {
      if (v > values[pk]) pk = i;
    });
    const every = labelEvery && w < labelEvery.belowWidth ? labelEvery.every : 1;
    const ticks = Math.round(sc.max / sc.step);

    svg = (
      <svg width={w} height={height} role="img" aria-label={ariaLabel}>
        {Array.from({ length: ticks + 1 }, (_, k) => {
          const y = Y(k * sc.step);
          return (
            <g key={k}>
              <line x1={M.l} x2={w - M.r} y1={y} y2={y} stroke={GRID} />
              <text x={M.l - 8} y={y + 4} textAnchor="end">
                {formatInt(k * sc.step)}
              </text>
            </g>
          );
        })}
        {values.map((v, i) => {
          const x = M.l + slot * i + (slot - bw) / 2;
          const y = Y(v);
          const r = Math.min(4, base - y);
          return (
            <g key={i}>
              <path
                className="col"
                d={`M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + bw - r}Q${x + bw},${y} ${x + bw},${y + r}V${base}Z`}
                fill={ACCENT}
              />
              <rect
                className="hit"
                x={M.l + slot * i}
                y={M.t}
                width={slot}
                height={Math.max(base - M.t, 0)}
                fill="transparent"
                onPointerMove={(e) =>
                  tip.show(e, { title: titleOf(i), rows: [{ color: ACCENT, value: formatInt(values[i]), label: unit }] })
                }
                onPointerLeave={tip.hide}
              />
              {i % every === 0 && (
                <text x={M.l + slot * i + slot / 2} y={height - 6} textAnchor="middle">
                  {labels[i]}
                </text>
              )}
            </g>
          );
        })}
        <text className="peak" x={M.l + slot * pk + slot / 2} y={Y(values[pk]) - 6} textAnchor="middle">
          {formatInt(values[pk])}
        </text>
      </svg>
    );
  }

  return (
    <div ref={ref} className="st-chart" style={{ minHeight: height }}>
      {svg}
    </div>
  );
}
