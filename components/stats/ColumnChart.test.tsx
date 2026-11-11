// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChartTipProvider } from "@/components/stats/ChartTip";
import { ColumnChart } from "@/components/stats/ColumnChart";
import { stubMeasure } from "@/components/stats/test-utils";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const props = {
  labels: ["'20", "'21", "'22"],
  values: [5, 12, 3],
  height: 200,
  ariaLabel: "Games by release year",
  unit: ["game", "games"] as [string, string],
  titleOf: (i: number) => String(2020 + i),
};
const draw = (p: Parameters<typeof ColumnChart>[0] = props) =>
  render(
    <ChartTipProvider>
      <ColumnChart {...p} />
    </ChartTipProvider>,
  );

describe("<ColumnChart>", () => {
  it("draws nothing before the first measure, with the height reserved", () => {
    stubMeasure(0);
    const { container } = draw();
    expect(container.querySelector("svg")).toBeNull();
    // border-box + 12px bottom padding of .st-chart: same total height as the drawn chart (200 + 12)
    expect((container.querySelector(".st-chart") as HTMLElement).style.minHeight).toBe("212px");
  });

  it("draws one column per value and writes the record above it", () => {
    stubMeasure(600);
    const { container } = draw();
    expect(container.querySelector("svg")).toHaveAttribute("aria-label", "Games by release year");
    expect(container.querySelectorAll("path.col")).toHaveLength(3);
    expect(container.querySelector("text.peak")).toHaveTextContent("12");
  });

  it("shows the tooltip of a column on pointer move", () => {
    stubMeasure(600);
    const { container } = draw();
    fireEvent.pointerMove(container.querySelectorAll("rect.hit")[1], { clientX: 200, clientY: 100 });
    const tip = document.body.querySelector(".st-tip") as HTMLElement;
    expect(tip).toHaveTextContent("2021");
    expect(tip.querySelector(".r b")).toHaveTextContent("12");
    expect(tip.querySelector(".r span")).toHaveTextContent("games");
    fireEvent.pointerLeave(container.querySelectorAll("rect.hit")[1]);
    expect(document.body.querySelector(".st-tip")).toBeNull();
  });

  it("writes the unit in the singular for 1 and in the plural otherwise", () => {
    stubMeasure(600);
    const { container } = draw({ ...props, values: [1, 12, 0] });
    const unitAt = (i: number) => {
      fireEvent.pointerMove(container.querySelectorAll("rect.hit")[i], { clientX: 200, clientY: 100 });
      return (document.body.querySelector(".st-tip .r span") as HTMLElement).textContent;
    };
    expect(unitAt(0)).toBe("game");
    expect(unitAt(1)).toBe("games");
    expect(unitAt(2)).toBe("games");
  });

  it("keeps the corner radius within half the column width", () => {
    stubMeasure(100);
    const { container } = draw({ ...props, labels: Array(24).fill("a"), values: Array(24).fill(50) });
    const d = container.querySelector("path.col")!.getAttribute("d")!;
    const m = /Q[\d.]+,[\d.]+ ([\d.]+),[\d.]+H([\d.]+)Q/.exec(d)!;
    // the top edge must not run backwards: the end of the first corner is left of the start of the second
    expect(Number(m[1])).toBeLessThanOrEqual(Number(m[2]));
  });

  it("has no NaN when every value is 0", () => {
    stubMeasure(600);
    const { container } = draw({ ...props, values: [0, 0, 0] });
    expect(container.innerHTML).not.toContain("NaN");
    expect(container.innerHTML).not.toContain("Infinity");
  });

  it("thins the labels below the given width", () => {
    stubMeasure(300);
    const { container } = draw({ ...props, labelEvery: { every: 2, belowWidth: 700 } });
    const labels = [...container.querySelectorAll("text:not(.peak)")].map((t) => t.textContent);
    expect(labels).toContain("'20");
    expect(labels).not.toContain("'21");
    expect(labels).toContain("'22");
  });
});
