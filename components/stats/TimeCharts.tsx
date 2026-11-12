"use client";

import { useMemo, type ReactNode } from "react";
import type { TrophyType } from "@/src/db/schema";
import { compactTick, formatInt, monotonePath, niceScale } from "@/src/stats/chart-geometry";
import type { MonthPoint } from "@/src/stats/trophy-charts";
import { ACCENT, GRID, SURFACE, TYPE_COLORS } from "./colors";
import type { TipContent } from "./ChartTip";
import { useCrosshair } from "./useCrosshair";
import { useWidth } from "./useWidth";

const PAD = 32; // .st-chart horizontal padding
const PAD_BOTTOM = 12; // .st-chart bottom padding: the drawn chart is height + 12 tall
const TYPES: TrophyType[] = ["platinum", "gold", "silver", "bronze"]; // bottom to top
const NAMES: Record<TrophyType, string> = { platinum: "Platinum", gold: "Gold", silver: "Silver", bronze: "Bronze" };

type Margin = { t: number; r: number; b: number; l: number };

/** Horizontal grid with the value of each line on the left. */
function Grid({ w, h, m, sc, fmt }: { w: number; h: number; m: Margin; sc: { step: number; max: number }; fmt: (v: number) => string }) {
  const ticks = Math.round(sc.max / sc.step);
  return (
    <>
      {Array.from({ length: ticks + 1 }, (_, k) => {
        const y = m.t + (h - m.t - m.b) * (1 - (k * sc.step) / sc.max);
        return (
          <g key={k}>
            <line x1={m.l} x2={w - m.r} y1={y} y2={y} stroke={GRID} />
            <text x={m.l - 8} y={y + 4} textAnchor="end">
              {fmt(k * sc.step)}
            </text>
          </g>
        );
      })}
    </>
  );
}

/** x of month i; a lone month sits in the middle. */
const xOf = (i: number, n: number, w: number, m: Margin) => m.l + ((w - m.l - m.r) * (n > 1 ? i / (n - 1) : 0.5));

function MonthLabels({ months, w, h, m }: { months: MonthPoint[]; w: number; h: number; m: Margin }) {
  const every = w < 420 ? 24 : w < 700 ? 12 : 6; // fewer labels on a phone, or they overlap
  return (
    <>
      {months.map((x, i) =>
        i % every === 0 ? (
          <text key={i} x={xOf(i, months.length, w, m)} y={h - 6} textAnchor="middle">
            {x.label}
          </text>
        ) : null,
      )}
    </>
  );
}

const Crosshair = ({ x, m, h, opacity }: { x: number | undefined; m: Margin; h: number; opacity: number }) =>
  x === undefined ? null : <line className="xh" x1={x} x2={x} y1={m.t} y2={h - m.b} stroke={`rgba(255,255,255,${opacity})`} />;

/** Panel body: measures its width, then hands it to `children`. */
function Measured({ height, children }: { height: number; children: (w: number) => ReactNode }) {
  const [ref, measured] = useWidth<HTMLDivElement>();
  return (
    <div ref={ref} className="st-chart" style={{ minHeight: height + PAD_BOTTOM }}>
      {measured !== null && children(Math.max(measured - PAD, 0))}
    </div>
  );
}

// ---------- Monthly activity ----------

const ACT = { h: 220, m: { t: 14, r: 12, b: 24, l: 44 } };

function ActivityChart({ months, w }: { months: MonthPoint[]; w: number }) {
  const { h, m } = ACT;
  const n = months.length;
  const xs = useMemo(() => months.map((_, i) => xOf(i, n, w, m)), [months, n, w, m]);
  const tipFor = useMemo(
    () =>
      (i: number): TipContent => ({
        title: months[i].title,
        rows: [{ color: ACCENT, value: formatInt(months[i].trophies), label: months[i].trophies === 1 ? "trophy" : "trophies" }],
      }),
    [months],
  );
  const { ref, index, handlers } = useCrosshair(xs, tipFor);

  const sc = niceScale(Math.max(...months.map((x) => x.trophies)), 4);
  const Y = (v: number) => m.t + (h - m.t - m.b) * (1 - v / sc.max);
  const line = monotonePath(months.map((x, i) => [xs[i], Y(x.trophies)]));
  let pk = 0;
  months.forEach((x, i) => {
    if (x.trophies > months[pk].trophies) pk = i;
  });

  return (
    <svg ref={ref} width={w} height={h} role="img" aria-label="Trophies earned each month">
      <Grid w={w} h={h} m={m} sc={sc} fmt={formatInt} />
      <MonthLabels months={months} w={w} h={h} m={m} />
      <path d={`${line}L${xs[n - 1]},${Y(0)}L${xs[0]},${Y(0)}Z`} fill={ACCENT} opacity={0.1} />
      <path d={line} fill="none" stroke={ACCENT} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={xs[pk]} cy={Y(months[pk].trophies)} r={4} fill={ACCENT} stroke={SURFACE} strokeWidth={2} />
      <text className="peak" x={xs[pk]} y={Y(months[pk].trophies) - 9} textAnchor="middle">
        {formatInt(months[pk].trophies)}
      </text>
      <Crosshair x={index === null ? undefined : xs[index]} m={m} h={h} opacity={0.4} />
      <rect className="hit" x={0} y={0} width={w} height={h} fill="transparent" {...handlers} />
    </svg>
  );
}

export function MonthlyActivity({ months }: { months: MonthPoint[] }) {
  return (
    <section className="panel glass">
      <div className="st-head">
        <h2>Monthly activity</h2>
        <div className="aside">Trophies earned each month</div>
      </div>
      <Measured height={ACT.h}>{(w) => (months.length > 0 ? <ActivityChart months={months} w={w} /> : null)}</Measured>
    </section>
  );
}

// ---------- Trophy progression ----------

const PROG = { h: 300, m: { t: 12, r: 12, b: 24, l: 48 } };
const total = (x: MonthPoint) => x.platinum + x.gold + x.silver + x.bronze;

function ProgressionChart({ months, w }: { months: MonthPoint[]; w: number }) {
  const { h, m } = PROG;
  const n = months.length;
  const xs = useMemo(() => months.map((_, i) => xOf(i, n, w, m)), [months, n, w, m]);
  const tipFor = useMemo(
    () =>
      (i: number): TipContent => ({
        title: months[i].title,
        rows: [
          { value: formatInt(total(months[i])), label: "total" },
          ...[...TYPES].reverse().map((t) => ({ color: TYPE_COLORS[t], value: formatInt(months[i][t]), label: NAMES[t] })),
        ],
      }),
    [months],
  );
  const { ref, index, handlers } = useCrosshair(xs, tipFor);

  const sc = niceScale(total(months[n - 1]), 5);
  const Y = (v: number) => m.t + (h - m.t - m.b) * (1 - v / sc.max);
  const stacked: number[][] = [];
  const bands = TYPES.map((t, k) => {
    const base = stacked[k - 1] ?? months.map(() => 0);
    const top = months.map((x, i) => base[i] + x[t]);
    const up = monotonePath(top.map((v, i) => [xs[i], Y(v)]));
    let down = "";
    for (let i = n - 1; i >= 0; i--) down += `L${xs[i]},${Y(base[i])}`;
    stacked.push(top);
    return (
      <g key={t}>
        <path className="band" data-type={t} d={`${up}${down}Z`} fill={TYPE_COLORS[t]} opacity={0.88} />
        <path d={up} fill="none" stroke={SURFACE} strokeWidth={1.5} />
      </g>
    );
  });

  return (
    <svg ref={ref} width={w} height={h} role="img" aria-label="Trophies earned over time, by type">
      <Grid w={w} h={h} m={m} sc={sc} fmt={compactTick} />
      <MonthLabels months={months} w={w} h={h} m={m} />
      {bands}
      <Crosshair x={index === null ? undefined : xs[index]} m={m} h={h} opacity={0.55} />
      <rect className="hit" x={0} y={0} width={w} height={h} fill="transparent" {...handlers} />
    </svg>
  );
}

export function TrophyProgression({ months, counts }: { months: MonthPoint[]; counts: Record<TrophyType, number> }) {
  return (
    <section className="panel glass">
      <div className="st-head">
        <h2>Trophy progression</h2>
        <div className="st-legend">
          {TYPES.map((t) => (
            <span key={t}>
              <i style={{ background: TYPE_COLORS[t] }} />
              {NAMES[t]} <b>{formatInt(counts[t])}</b>
            </span>
          ))}
        </div>
      </div>
      <Measured height={PROG.h}>{(w) => (months.length > 0 ? <ProgressionChart months={months} w={w} /> : null)}</Measured>
    </section>
  );
}
