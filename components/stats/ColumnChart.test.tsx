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

  it("shows the tooltip while a finger is down and hides it when lifted", () => {
    stubMeasure(600);
    const { container } = draw();
    const hit = container.querySelectorAll("rect.hit");
    fireEvent.pointerDown(hit[1], { pointerType: "touch", clientX: 200, clientY: 300 });
    expect(document.body.querySelector(".st-tip")).toHaveTextContent("2021");
    fireEvent.pointerUp(hit[1], { pointerType: "touch" });
    fireEvent.pointerLeave(hit[1], { pointerType: "touch" });
    expect(document.body.querySelector(".st-tip")).toBeNull();
  });

  it("hides the tooltip as soon as the finger is lifted, and keeps it for a mouse button release", () => {
    stubMeasure(600);
    const { container } = draw();
    const hit = container.querySelectorAll("rect.hit");
    fireEvent.pointerDown(hit[1], { pointerType: "touch", clientX: 200, clientY: 300 });
    fireEvent.pointerUp(hit[1], { pointerType: "touch" });
    expect(document.body.querySelector(".st-tip")).toBeNull();
    fireEvent.pointerMove(hit[1], { pointerType: "mouse", clientX: 200, clientY: 300 });
    fireEvent.pointerUp(hit[1], { pointerType: "mouse" });
    expect(document.body.querySelector(".st-tip")).not.toBeNull();
  });

  it("releases the pointer capture a touch pointer got on the column", () => {
    stubMeasure(600);
    const { container } = draw();
    const hit = container.querySelectorAll("rect.hit")[1] as Element;
    const release = vi.fn();
    Object.assign(hit, { hasPointerCapture: () => true, releasePointerCapture: release });
    fireEvent.pointerDown(hit, { pointerType: "touch", pointerId: 7, clientX: 200, clientY: 300 });
    expect(release).toHaveBeenCalledWith(7);
  });

  it("hides the tooltip when the page takes over the finger", () => {
    stubMeasure(600);
    const { container } = draw();
    const hit = container.querySelectorAll("rect.hit");
    fireEvent.pointerDown(hit[1], { pointerType: "touch", clientX: 200, clientY: 300 });
    expect(document.body.querySelector(".st-tip")).not.toBeNull();
    fireEvent.pointerCancel(hit[1], { pointerType: "touch" });
    expect(document.body.querySelector(".st-tip")).toBeNull();
  });

  it("follows the finger from one column to the next", () => {
    stubMeasure(600);
    const { container } = draw();
    const hit = container.querySelectorAll("rect.hit");
    fireEvent.pointerDown(hit[0], { pointerType: "touch", clientX: 100, clientY: 300 });
    fireEvent.pointerMove(hit[1], { pointerType: "touch", clientX: 200, clientY: 300 });
    expect(document.body.querySelector(".st-tip")).toHaveTextContent("2021");
  });

  it("blocks the long-press menu for a finger only", () => {
    stubMeasure(600);
    const { container } = draw();
    const hit = container.querySelectorAll("rect.hit")[0];
    const menu = (pointerType: string) => hit.dispatchEvent(new PointerEvent("contextmenu", { pointerType, bubbles: true, cancelable: true }));
    expect(menu("touch")).toBe(false);
    expect(menu("mouse")).toBe(true);
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

  describe("with minSlot", () => {
    const many = { ...props, labels: Array.from({ length: 30 }, (_, i) => `'${i}`), values: Array.from({ length: 30 }, (_, i) => i + 1), minSlot: 24 };
    const scrollWidth = (n: number) => vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(n);

    it("keeps the columns 18 px wide and scrolls when they do not fit", () => {
      stubMeasure(400);
      const { container } = draw(many);
      const side = container.querySelector(".st-side")!;
      expect(side.querySelector("svg")).toHaveAttribute("width", "724");
      const hits = side.querySelectorAll("rect.hit");
      expect(hits).toHaveLength(30);
      expect(hits[0]).toHaveAttribute("width", "24");
      const d = side.querySelector("path.col")!.getAttribute("d")!;
      const m = /^M([\d.]+),[\d.]+V[\d.]+Q[\d.]+,[\d.]+ [\d.]+,[\d.]+H([\d.]+)Q/.exec(d)!;
      expect(Number(m[1])).toBe(3);
      const axis = container.querySelector("svg.st-yaxis")!;
      expect(axis).toHaveAttribute("width", "44");
      expect(side.contains(axis)).toBe(false);
      expect(axis.querySelectorAll("text").length).toBeGreaterThan(0);
      expect(side.querySelector("svg")).toHaveAttribute("aria-label", "Games by release year");
    });

    it("fills the width when the columns fit", () => {
      stubMeasure(600);
      const { container } = draw({ ...many, labels: props.labels, values: props.values });
      expect(container.querySelector(".st-side svg")).toHaveAttribute("width", "524");
    });

    it("opens on the most recent years", () => {
      stubMeasure(400);
      scrollWidth(724);
      const { container } = draw(many);
      expect((container.querySelector(".st-side") as HTMLElement).scrollLeft).toBe(724);
    });

    it("shows the tooltip of a column in scroll mode", () => {
      stubMeasure(400);
      const { container } = draw(many);
      fireEvent.pointerMove(container.querySelectorAll(".st-side rect.hit")[1], { clientX: 200, clientY: 100 });
      expect(document.body.querySelector(".st-tip")).toHaveTextContent("2021");
    });

    it("keeps the tooltip on a mouse click without a drag", () => {
      stubMeasure(400);
      scrollWidth(724);
      const { container } = draw(many);
      const side = container.querySelector(".st-side") as HTMLElement;
      const before = side.scrollLeft;
      const hit = container.querySelectorAll(".st-side rect.hit")[1];
      fireEvent.pointerDown(hit, { pointerType: "mouse", button: 0, buttons: 1, clientX: 200, clientY: 100 });
      fireEvent.pointerUp(hit, { pointerType: "mouse", button: 0, clientX: 200, clientY: 100 });
      expect(document.body.querySelector(".st-tip")).toHaveTextContent("2021");
      expect(side.scrollLeft).toBe(before);
    });

    it("has no NaN with one value or only zeros", () => {
      stubMeasure(400);
      for (const values of [[7], [0, 0, 0]]) {
        const { container } = draw({ ...many, labels: values.map(String), values });
        expect(container.innerHTML).not.toContain("NaN");
        expect(container.innerHTML).not.toContain("Infinity");
        cleanup();
      }
    });

    it("renders neither a scroller nor an axis without minSlot", () => {
      stubMeasure(600);
      const { container } = draw();
      expect(container.querySelector(".st-side")).toBeNull();
      expect(container.querySelector("svg.st-yaxis")).toBeNull();
    });
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
