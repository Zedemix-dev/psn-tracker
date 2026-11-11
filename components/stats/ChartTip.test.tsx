// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ChartTipProvider, useChartTip, type TipContent } from "@/components/stats/ChartTip";

const content: TipContent = { title: "Mar 2026", rows: [{ color: "#5AA9FF", value: "42", label: "trophies" }], note: "peak" };

let api: ReturnType<typeof useChartTip>;
function Probe() {
  api = useChartTip();
  return null;
}
const setup = () =>
  render(
    <ChartTipProvider>
      <Probe />
    </ChartTipProvider>,
  );

afterEach(cleanup);

describe("<ChartTipProvider>", () => {
  it("shows the title, the value and the label in document.body", () => {
    const { container } = setup();
    act(() => api.show({ clientX: 100, clientY: 100 }, content));
    const tip = document.body.querySelector(".st-tip") as HTMLElement;
    expect(tip).toBeInTheDocument();
    expect(container.contains(tip)).toBe(false);
    expect(tip.querySelector(".h")).toHaveTextContent("Mar 2026");
    expect(tip.querySelector(".r b")).toHaveTextContent("42");
    expect(tip.querySelector(".r span")).toHaveTextContent("trophies");
    expect(tip).toHaveTextContent("peak");
  });

  it("hides on hide() and on scroll", () => {
    setup();
    act(() => api.show({ clientX: 1, clientY: 1 }, content));
    act(() => api.hide());
    expect(document.body.querySelector(".st-tip")).toBeNull();
    act(() => api.show({ clientX: 1, clientY: 1 }, content));
    expect(screen.getByText("Mar 2026")).toBeInTheDocument();
    act(() => void window.dispatchEvent(new Event("scroll")));
    expect(document.body.querySelector(".st-tip")).toBeNull();
  });

  it("is gone when the provider unmounts", () => {
    const { unmount } = setup();
    act(() => api.show({ clientX: 1, clientY: 1 }, content));
    unmount();
    expect(document.body.querySelector(".st-tip")).toBeNull();
  });
});
