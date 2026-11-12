"use client";

import Link from "next/link";
import { useMemo } from "react";
import { TileImage } from "@/components/TileImage";
import { TrophyTypeIcon } from "@/components/TrophyTypeIcon";
import { levelSpriteStyle } from "@/components/levelSprite";
import { formatInt, niceScale } from "@/src/stats/chart-geometry";
import type { LevelRow } from "@/src/stats/load";
import { GRID, LEVEL, SURFACE } from "./colors";
import type { TipContent } from "./ChartTip";
import { useCrosshair } from "./useCrosshair";
import { useWidth } from "./useWidth";

const PAD = 32; // .st-chart horizontal padding
const PAD_BOTTOM = 12; // .st-chart bottom padding: the drawn chart is height + 12 tall
const H = 240;
const M = { t: 14, r: 16, b: 24, l: 44 };
const DAY_MS = 86_400_000;
const TYPE_NAME = { platinum: "Platinum", gold: "Gold", silver: "Silver", bronze: "Bronze" } as const;

function LevelChart({ points, w }: { points: LevelRow[]; w: number }) {
  // oldest first; the axis starts 45 days before the first point
  const t0 = points[0].earnedAtMs - 45 * DAY_MS;
  const t1 = points[points.length - 1].earnedAtMs;
  const span = Math.max(t1 - t0, 1);
  const X = (t: number) => M.l + ((w - M.l - M.r) * (t - t0)) / span;
  const xs = useMemo(() => points.map((p) => M.l + ((w - M.l - M.r) * (p.earnedAtMs - t0)) / span), [points, w, t0, span]);
  const tipFor = useMemo(
    () =>
      (i: number): TipContent => ({
        title: points[i].date,
        rows: [{ color: LEVEL, value: `Level ${points[i].level}`, label: "" }],
        note: points[i].name,
      }),
    [points],
  );
  const { ref, index, handlers } = useCrosshair(xs, tipFor);

  const sc = niceScale(points[points.length - 1].level, 6);
  const Y = (v: number) => M.t + (H - M.t - M.b) * (1 - v / sc.max);
  const ticks = Math.round(sc.max / sc.step);
  const years: number[] = [];
  for (let y = new Date(t0).getUTCFullYear() + 1; Date.UTC(y, 0, 1) <= t1; y++) years.push(y);
  const ys = points.map((p) => Y(p.level));
  const narrow = w < 420; // a label every other year, or they overlap

  return (
    <svg ref={ref} width={w} height={H} role="img" aria-label="PSN level over time">
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
      {years.map((y, i) => (
        <g key={y}>
          {(!narrow || i % 2 === 0) && (
            <text x={X(Date.UTC(y, 0, 1))} y={H - 6} textAnchor="middle">
              {y}
            </text>
          )}
          <line x1={X(Date.UTC(y, 0, 1))} x2={X(Date.UTC(y, 0, 1))} y1={H - M.b} y2={H - M.b + 4} stroke={GRID} />
        </g>
      ))}
      <path d={`M${xs.map((x, i) => `${x},${ys[i]}`).join("L")}`} fill="none" stroke={LEVEL} strokeWidth={2} strokeLinejoin="round" />
      {xs.map((x, i) => (
        <circle key={points[i].key} className="pt" cx={x} cy={ys[i]} r={4} fill={LEVEL} stroke={SURFACE} strokeWidth={2} />
      ))}
      {index !== null && (
        <>
          <circle className="hl" cx={xs[index]} cy={ys[index]} r={6} fill={LEVEL} stroke="#fff" strokeWidth={2} />
          <line className="xh" x1={xs[index]} x2={xs[index]} y1={M.t} y2={H - M.b} stroke="rgba(255,255,255,.4)" />
        </>
      )}
      <rect className="hit" x={0} y={0} width={w} height={H} fill="transparent" {...handlers} />
    </svg>
  );
}

function LevelItem({ row }: { row: LevelRow }) {
  const href = `/games/${encodeURIComponent(row.gameId)}`;
  return (
    <div className="st-lrow">
      <Link href={href} prefetch={false} className="gl">
        {row.gameIsIcon ? (
          <TileImage tile bg={row.gameTileBg} className="gc icon" src={row.gameSrc} alt={row.gameName} loading="lazy" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- images are already cached and sized by the app, no next/image optimizer wanted
          <img className="gc" src={row.gameSrc} alt={row.gameName} loading="lazy" />
        )}
      </Link>
      {/* eslint-disable-next-line @next/next/no-img-element -- images are already cached and sized by the app, no next/image optimizer wanted */}
      <img className="ic" src={row.iconSrc} alt="" loading="lazy" />
      <div>
        <div className="nm">{row.name}</div>
        <div className="ds">{row.detail}</div>
        <div className="g">
          <Link href={href} prefetch={false}>
            {row.gameName}
          </Link>
        </div>
      </div>
      <div className="st-meta">
        <div className="st-lv">
          <div className="sp" style={levelSpriteStyle(row.tier)} />
          <b>{row.level}</b>
        </div>
        <div className="st-dt">
          <b>{row.date}</b>
          {row.time}
        </div>
        <div className="st-rt">
          {row.ratePct && (
            <>
              <b>{row.ratePct}</b>
              {row.rarity}
            </>
          )}
        </div>
      </div>
      <div className="st-ty">
        <TrophyTypeIcon type={row.type} size={30} />
        {TYPE_NAME[row.type]}
      </div>
    </div>
  );
}

function LevelBody({ levels }: { levels: LevelRow[] }) {
  const [ref, measured] = useWidth<HTMLDivElement>();
  const points = useMemo(() => [...levels].reverse(), [levels]);
  return (
    <>
      <div ref={ref} className="st-chart" style={{ minHeight: H + PAD_BOTTOM }}>
        {measured !== null && <LevelChart points={points} w={Math.max(measured - PAD, 0)} />}
      </div>
      <div>
        {levels.map((row) => (
          <LevelItem key={row.key} row={row} />
        ))}
      </div>
    </>
  );
}

/** `levels` is newest first, as the loader returns it. */
export function LevelHistory({ levels }: { levels: LevelRow[] }) {
  return (
    <section className="panel glass">
      <div className="st-head">
        <h2>Level history</h2>
        <div className="aside">A point every 10 levels</div>
      </div>
      {levels.length > 0 && <LevelBody levels={levels} />}
    </section>
  );
}
