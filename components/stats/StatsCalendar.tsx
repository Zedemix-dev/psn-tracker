"use client";

import { useEffect } from "react";
import { formatInt } from "@/src/stats/chart-geometry";
import type { CalendarData, CalendarDay } from "@/src/stats/trophy-charts";
import { tipHandlers, useChartTip } from "./ChartTip";
import { useSideScroll } from "./useSideScroll";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DASH = "–";

/** 0 none, 1-2, 3-6, 7-12, 13 and more. */
const intensity = (n: number) => (n === 0 ? "" : n <= 2 ? " l1" : n <= 6 ? " l2" : n <= 12 ? " l3" : " l4");
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

function Cell({ day }: { day: CalendarDay | null }) {
  const tip = useChartTip();
  if (!day) return <div className="st-cell out" />;
  return (
    <div
      className={`st-cell${intensity(day.trophies)}`}
      {...tipHandlers(tip, () => ({
        title: day.label,
        rows: [
          { value: formatInt(day.trophies), label: plural(day.trophies, "trophy", "trophies") },
          ...(day.platinums > 0 ? [{ value: String(day.platinums), label: plural(day.platinums, "platinum", "platinums") }] : []),
        ],
      }))}
    />
  );
}

export function StatsCalendar({ data }: { data: CalendarData }) {
  const tip = useChartTip();
  // Opens on the most recent days.
  const side = useSideScroll<HTMLDivElement>();
  useEffect(() => tip.hide, [tip.hide]);

  const { summary } = data;
  return (
    <section className="panel glass" aria-label="Last 12 months">
      <div className="st-head">
        <h2>Last 12 months</h2>
        <div className="st-scale">
          Less<span></span>
          <div className="st-cell"></div>
          <div className="st-cell l1"></div>
          <div className="st-cell l2"></div>
          <div className="st-cell l3"></div>
          <div className="st-cell l4"></div>
          <span></span>More
        </div>
      </div>
      {/* eslint-disable-next-line react-hooks/refs -- side.ref is a callback ref (it stores the node in state), not a ref object read during render */}
      <div className={`st-cal-scroll ${side.className}`} ref={side.ref} {...side.handlers}>
        <div className="st-cal">
          <div className="st-cal-months">
            <span></span>
            {data.months.map((m) => (
              <span key={m.column} style={{ gridColumn: m.column + 2 }}>
                {m.label}
              </span>
            ))}
          </div>
          <div className="st-cal-grid">
            {WEEKDAYS.map((name, r) => [
              <div className="d" key={`d${r}`}>
                {name}
              </div>,
              ...data.weeks.map((week, w) => <Cell key={`${r}-${w}`} day={week[r]} />),
            ])}
          </div>
        </div>
      </div>
      <div className="st-sum">
        <div>
          <b>{formatInt(summary.trophies)}</b>
          <span>Trophies</span>
        </div>
        <div>
          <b>{formatInt(summary.platinums)}</b>
          <span>Platinums</span>
        </div>
        <div>
          <b>
            {summary.bestDay ? (
              <>
                {summary.bestDay.trophies}
                <small>{summary.bestDay.label}</small>
              </>
            ) : (
              DASH
            )}
          </b>
          <span>Best day</span>
        </div>
        <div>
          <b>
            {summary.streak ? (
              <>
                {summary.streak.days} {plural(summary.streak.days, "day", "days")}
                <small>{formatInt(summary.streak.trophies)} {plural(summary.streak.trophies, "trophy", "trophies")}</small>
              </>
            ) : (
              DASH
            )}
          </b>
          <span>{summary.streak ? `Longest streak, ${summary.streak.from} to ${summary.streak.to}` : "Longest streak"}</span>
        </div>
      </div>
    </section>
  );
}
