// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChartTipProvider } from "@/components/stats/ChartTip";
import { StatsCalendar } from "@/components/stats/StatsCalendar";
import type { CalendarData, CalendarDay } from "@/src/stats/trophy-charts";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const day = (trophies: number, platinums = 0, n = 0): CalendarDay => ({
  date: `2026-09-${String(n + 1).padStart(2, "0")}`,
  label: `Mon ${n + 1} Sep 2026`,
  trophies,
  platinums,
});

/** 53 weeks; the last one has only Mon to Wed. `first` fills the first cells of the first week. */
function calendar(first: number[] = [], over: Partial<CalendarData["summary"]> = {}): CalendarData {
  const weeks: (CalendarDay | null)[][] = Array.from({ length: 53 }, (_, w) =>
    Array.from({ length: 7 }, (_, r) => (w === 52 && r > 2 ? null : day(0, 0, w * 7 + r))),
  );
  first.forEach((n, i) => (weeks[0][i] = day(n, n === 12 ? 2 : 0, i)));
  return {
    weeks,
    months: [{ column: 3, label: "Dec" }],
    summary: {
      trophies: 1773,
      platinums: 45,
      bestDay: { trophies: 35, label: "Mon 31 Aug 2026" },
      streak: { days: 61, trophies: 515, from: "13 Jul 2026", to: "11 Sep 2026" },
      ...over,
    },
  };
}

const rowsOf = (tip: HTMLElement) =>
  [...tip.querySelectorAll(".r")].map((r) => `${r.querySelector("b")?.textContent} ${r.querySelector("span")?.textContent}`);

const draw = (data: CalendarData) =>
  render(
    <ChartTipProvider>
      <StatsCalendar data={data} />
    </ChartTipProvider>,
  );

describe("<StatsCalendar>", () => {
  it("draws a cell per day, hides the days to come and labels the weekdays", () => {
    const { container, getByRole } = draw(calendar());
    expect(getByRole("heading", { name: "Last 12 months" })).toBeInTheDocument();
    expect(container.querySelectorAll(".st-cal .st-cell:not(.out)")).toHaveLength(53 * 7 - 4);
    expect(container.querySelectorAll(".st-cal .st-cell.out")).toHaveLength(4);
    expect([...container.querySelectorAll(".st-cal-grid .d")].map((d) => d.textContent)).toEqual([
      "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun",
    ]);
    expect(container.querySelector(".st-scale")).toHaveTextContent("Less");
    expect(container.querySelector(".st-scale")).toHaveTextContent("More");
    const month = container.querySelector(".st-cal-months span:not(:empty)") as HTMLElement;
    expect(month).toHaveTextContent("Dec");
    expect(month.style.gridColumn).toBe("5");
  });

  it("shows the tooltip of a day while a finger is down", () => {
    const { container } = draw(calendar([12]));
    const cell = container.querySelector(".st-cal-grid .st-cell:not(.out)") as Element;
    fireEvent.pointerDown(cell, { pointerType: "touch", clientX: 50, clientY: 50 });
    expect(document.body.querySelector(".st-tip")).toHaveTextContent("Mon 1 Sep 2026");
    fireEvent.pointerLeave(cell, { pointerType: "touch" });
    expect(document.body.querySelector(".st-tip")).toBeNull();
  });

  it("gives a cell the intensity of its count", () => {
    const counts = [0, 2, 3, 6, 7, 12, 13];
    const { container } = draw(calendar(counts));
    const cells = [...container.querySelectorAll(".st-cal-grid .st-cell")];
    // the grid is row-major: row r starts at index r * 53
    const classes = counts.map((_, r) => cells[r * 53].className.replace("st-cell", "").trim());
    expect(classes).toEqual(["", "l1", "l2", "l2", "l3", "l3", "l4"]);
  });

  it("shows the date, the trophies and the platinums in the tooltip", () => {
    const { container } = draw(calendar([12]));
    fireEvent.pointerMove(container.querySelector(".st-cal-grid .st-cell") as Element, { clientX: 50, clientY: 50 });
    const tip = document.body.querySelector(".st-tip") as HTMLElement;
    expect(tip).toHaveTextContent("Mon 1 Sep 2026");
    expect(rowsOf(tip)).toEqual(["12 trophies", "2 platinums"]);
  });

  it("uses the singular and omits the platinum row when there is none", () => {
    const { container } = draw(calendar([1]));
    const cell = container.querySelector(".st-cal-grid .st-cell") as Element;
    fireEvent.pointerMove(cell, { clientX: 50, clientY: 50 });
    const tip = document.body.querySelector(".st-tip") as HTMLElement;
    expect(rowsOf(tip)).toEqual(["1 trophy"]);
    fireEvent.pointerLeave(cell);
    expect(document.body.querySelector(".st-tip")).toBeNull();
  });

  it("writes the four summary values", () => {
    const { container } = draw(calendar());
    const sum = container.querySelector(".st-sum") as HTMLElement;
    for (const text of [
      "1,773", "Trophies", "45", "Platinums", "35", "Mon 31 Aug 2026", "Best day",
      "61 days", "515 trophies", "Longest streak, 13 Jul 2026 to 11 Sep 2026",
    ]) {
      expect(sum).toHaveTextContent(text);
    }
    expect(sum.children).toHaveLength(4);
  });

  it("writes the streak in the singular for 1 day and 1 trophy", () => {
    const { container } = draw(calendar([], { streak: { days: 1, trophies: 1, from: "1 Sep 2026", to: "1 Sep 2026" } }));
    const cell = container.querySelector(".st-sum")!.children[3];
    expect(cell).toHaveTextContent(/^1 day1 trophy/);
  });

  it("writes a dash when there is no best day and no streak", () => {
    const { container } = draw(calendar([], { bestDay: null, streak: null, trophies: 0, platinums: 0 }));
    const sum = container.querySelector(".st-sum") as HTMLElement;
    expect(sum.children[2].querySelector("b")).toHaveTextContent("–");
    expect(sum.children[3].querySelector("b")).toHaveTextContent("–");
    expect(sum.children[3]).toHaveTextContent("Longest streak");
    expect(sum).not.toHaveTextContent("undefined");
  });

  it("scrolls to the most recent days on mount", () => {
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(1500);
    const { container } = draw(calendar());
    expect((container.querySelector(".st-cal-scroll") as HTMLElement).scrollLeft).toBe(1500);
  });
});
