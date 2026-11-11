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
  unit: "games",
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
    expect((container.querySelector(".st-chart") as HTMLElement).style.minHeight).toBe("200px");
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
