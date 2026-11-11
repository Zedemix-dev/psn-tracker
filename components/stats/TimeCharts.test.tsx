// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChartTipProvider } from "@/components/stats/ChartTip";
import { MonthlyActivity, TrophyProgression } from "@/components/stats/TimeCharts";
import { stubMeasure } from "@/components/stats/test-utils";
import type { MonthPoint } from "@/src/stats/trophy-charts";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** `n` months from Jan 2020; `per(i)` trophies earned in month i. */
function months(n: number, per: (i: number) => number = () => 10): MonthPoint[] {
  let total = 0;
  return Array.from({ length: n }, (_, i) => {
    const earned = per(i);
    total += earned;
    const y = 2020 + Math.floor(i / 12);
    return {
      label: `${NAMES[i % 12]} ${String(y % 100).padStart(2, "0")}`,
      title: `${NAMES[i % 12]} ${y}`,
      trophies: earned,
      platinum: 1 + i,
      gold: 2 + i,
      silver: 3 + i,
      bronze: total,
    };
  });
}
const counts = { platinum: 230, gold: 990, silver: 2434, bronze: 7982 };
const wrap = (ui: ReactElement) => render(<ChartTipProvider>{ui}</ChartTipProvider>);
const axisLabels = (c: HTMLElement) =>
  [...c.querySelectorAll("svg text")].map((t) => t.textContent ?? "").filter((t) => /^[A-Z][a-z]{2} \d\d$/.test(t));

const tipRow = () => {
  const r = document.body.querySelector(".st-tip .r");
  return `${r?.querySelector("b")?.textContent} ${r?.querySelector("span")?.textContent}`;
};

describe("<MonthlyActivity>", () => {
  it("writes the record month and a label every 6 months", () => {
    stubMeasure(832); // 800 drawn
    const { container, getByRole } = wrap(<MonthlyActivity months={months(14, (i) => (i === 4 ? 40 : 10))} />);
    expect(getByRole("heading", { name: "Monthly activity" })).toBeInTheDocument();
    expect(container).toHaveTextContent("Trophies earned each month");
    expect(container.querySelector("text.peak")).toHaveTextContent("40");
    expect(axisLabels(container)).toEqual(["Jan 20", "Jul 20", "Jan 21"]);
    expect((container.querySelector(".st-chart") as HTMLElement).style.minHeight).toBe("232px");
  });

  it("labels every 12 months on a narrow screen", () => {
    stubMeasure(600);
    const { container } = wrap(<MonthlyActivity months={months(14)} />);
    expect(axisLabels(container)).toEqual(["Jan 20", "Jan 21"]);
  });

  it("labels every 6 months from 700px", () => {
    stubMeasure(732); // 700 drawn
    const { container } = wrap(<MonthlyActivity months={months(121)} />);
    expect(axisLabels(container)).toHaveLength(21);
  });

  it("labels every 12 months under 700px", () => {
    stubMeasure(731); // 699 drawn
    const { container } = wrap(<MonthlyActivity months={months(121)} />);
    expect(axisLabels(container)).toHaveLength(11);
  });

  it("labels every 24 months under 420px", () => {
    stubMeasure(451); // 419 drawn
    const { container } = wrap(<MonthlyActivity months={months(121)} />);
    expect(axisLabels(container)).toEqual(["Jan 20", "Jan 22", "Jan 24", "Jan 26", "Jan 28", "Jan 30"]);
  });

  it("labels every 12 months from 420px", () => {
    stubMeasure(452); // 420 drawn
    const { container } = wrap(<MonthlyActivity months={months(121)} />);
    expect(axisLabels(container)).toHaveLength(11);
  });

  it("thins the progression labels the same way", () => {
    stubMeasure(451);
    const { container } = wrap(<TrophyProgression months={months(121)} counts={counts} />);
    expect(axisLabels(container)).toHaveLength(6);
  });

  it("shows the month and its count, with singular and plural", () => {
    stubMeasure(832);
    const { container } = wrap(<MonthlyActivity months={months(3, (i) => (i === 1 ? 1 : 10))} />);
    const hit = container.querySelector("rect.hit") as Element;
    fireEvent.pointerMove(hit, { clientX: 1000, clientY: 50 }); // far right: the last month
    expect(document.body.querySelector(".st-tip")).toHaveTextContent("Mar 2020");
    expect(tipRow()).toBe("10 trophies");
    fireEvent.pointerMove(hit, { clientX: 440, clientY: 50 }); // middle
    expect(tipRow()).toBe("1 trophy");
    expect(container.querySelector("line.xh")).toBeInTheDocument();
    fireEvent.pointerLeave(hit);
    expect(document.body.querySelector(".st-tip")).toBeNull();
    expect(container.querySelector("line.xh")).toBeNull();
  });

  it("has no NaN with a single month", () => {
    stubMeasure(832);
    const { container } = wrap(<MonthlyActivity months={months(1)} />);
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("draws no chart without a month", () => {
    stubMeasure(832);
    const { container } = wrap(<MonthlyActivity months={[]} />);
    expect(container.querySelector("svg")).toBeNull();
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
  });
});

describe("<TrophyProgression>", () => {
  it("draws four bands, platinum at the bottom, and the legend totals", () => {
    stubMeasure(832);
    const { container, getByRole } = wrap(<TrophyProgression months={months(14)} counts={counts} />);
    expect(getByRole("heading", { name: "Trophy progression" })).toBeInTheDocument();
    expect([...container.querySelectorAll("path.band")].map((p) => p.getAttribute("data-type"))).toEqual([
      "platinum", "gold", "silver", "bronze",
    ]);
    const legend = container.querySelector(".st-legend") as HTMLElement;
    expect(legend).toHaveTextContent("Platinum 230");
    expect(legend).toHaveTextContent("Gold 990");
    expect(legend).toHaveTextContent("Silver 2,434");
    expect(legend).toHaveTextContent("Bronze 7,982");
    expect((container.querySelector(".st-chart") as HTMLElement).style.minHeight).toBe("312px");
  });

  it("shows every type and the total for the nearest month", () => {
    stubMeasure(832);
    const ms = months(3);
    const { container } = wrap(<TrophyProgression months={ms} counts={counts} />);
    fireEvent.pointerMove(container.querySelector("rect.hit") as Element, { clientX: 1000, clientY: 50 });
    const tip = document.body.querySelector(".st-tip") as HTMLElement;
    const last = ms[2];
    const total = last.platinum + last.gold + last.silver + last.bronze;
    expect(tip).toHaveTextContent("Mar 2020");
    expect([...tip.querySelectorAll(".r")].map((r) => r.textContent)).toEqual([
      `${total}total`,
      `${last.bronze}Bronze`,
      `${last.silver}Silver`,
      `${last.gold}Gold`,
      `${last.platinum}Platinum`,
    ]);
  });

  it("has no NaN with a single month", () => {
    stubMeasure(832);
    const { container } = wrap(<TrophyProgression months={months(1)} counts={counts} />);
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
    expect(container.querySelectorAll("path.band")).toHaveLength(4);
  });
});
