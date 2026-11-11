"use client";

import { useEffect } from "react";
import { formatInt } from "@/src/stats/chart-geometry";
import { useChartTip } from "./ChartTip";

type Segment = { label: string; value: number; color: string };

const R = 54;
const C = 2 * Math.PI * R;

export function DonutCard({
  title,
  segments,
  center,
  caption,
  unit,
}: {
  title: string;
  segments: Segment[];
  center: string;
  caption: string;
  unit: string;
}) {
  const tip = useChartTip();
  useEffect(() => tip.hide, [tip.hide]);

  const total = segments.reduce((a, s) => a + s.value, 0);
  let offset = 0;
  const circles = total > 0 ? segments.map((s) => {
    const f = s.value / total;
    const start = offset;
    offset += f * C;
    if (s.value <= 0) return null;
    const len = Math.max(f * C - 2, 1.2);
    return (
      <circle
        key={s.label}
        className="seg"
        cx={68}
        cy={68}
        r={R}
        fill="none"
        stroke={s.color}
        strokeWidth={20}
        strokeDasharray={`${len} ${C - len}`}
        strokeDashoffset={-start - 1}
        transform="rotate(-90 68 68)"
        onPointerMove={(e) =>
          tip.show(e, {
            title: s.label,
            rows: [{ color: s.color, value: formatInt(s.value), label: `${unit}, ${((s.value / total) * 100).toFixed(1)}%` }],
          })
        }
        onPointerLeave={tip.hide}
      />
    );
  }) : null;

  return (
    <section className="panel glass">
      <div className="st-head">
        <h2>{title}</h2>
      </div>
      <div className="st-donut-body">
        <svg className="st-donut-svg" viewBox="0 0 136 136" role="img" aria-label={title}>
          {circles}
          <text className="big" x={68} y={70} textAnchor="middle">
            {center}
          </text>
          <text className="cap" x={68} y={86} textAnchor="middle">
            {caption}
          </text>
        </svg>
        <ul className="st-dl">
          {segments.map((s) => (
            <li key={s.label}>
              <i style={{ background: s.color }} />
              <span>{s.label}</span>
              <b>{formatInt(s.value)}</b>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
