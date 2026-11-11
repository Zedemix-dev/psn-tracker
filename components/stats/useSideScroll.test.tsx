// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChartTipProvider, useChartTip } from "@/components/stats/ChartTip";
import { useSideScroll } from "@/components/stats/useSideScroll";

let scrollWidth = 1500;
let clientWidth = 600;
let observe: () => void = () => {};

beforeEach(() => {
  scrollWidth = 1500;
  clientWidth = 600;
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(() => scrollWidth);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => clientWidth);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(cb: () => void) {
        observe = cb;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function Probe() {
  const side = useSideScroll<HTMLDivElement>();
  const tip = useChartTip();
  return (
    <>
      <button onClick={(e) => tip.show(e as never, { title: "T", rows: [] })}>open</button>
      <div data-testid="s" ref={side.ref} className={side.className} {...side.handlers} />
    </>
  );
}

const draw = () => {
  render(
    <ChartTipProvider>
      <Probe />
    </ChartTipProvider>,
  );
  return screen.getByTestId("s");
};

const mouse = { pointerType: "mouse", button: 0, buttons: 1, pointerId: 1 };

describe("useSideScroll", () => {
  it("opens at the end", () => {
    const el = draw();
    expect(el.scrollLeft).toBe(1500);
    expect(el.classList.contains("can")).toBe(true);
    expect(el.classList.contains("fl")).toBe(true);
    expect(el.classList.contains("fr")).toBe(false);
  });

  it("has no grab and no fade when everything fits", () => {
    scrollWidth = 600;
    const el = draw();
    expect(el.className).toBe("st-side");
  });

  it("fades both sides in the middle", () => {
    const el = draw();
    el.scrollLeft = 300;
    fireEvent.scroll(el);
    expect(el.classList.contains("fl")).toBe(true);
    expect(el.classList.contains("fr")).toBe(true);
  });

  it("drags with the mouse", () => {
    const el = draw();
    el.scrollLeft = 300;
    fireEvent.scroll(el);
    fireEvent.pointerDown(el, { ...mouse, clientX: 500 });
    fireEvent.pointerMove(el, { ...mouse, clientX: 560 });
    expect(el.scrollLeft).toBe(240);
    expect(el.classList.contains("drag")).toBe(true);
    fireEvent.pointerUp(el, { ...mouse, clientX: 560 });
    expect(el.classList.contains("drag")).toBe(false);
  });

  it("ignores a click that moves less than 4 px", () => {
    const el = draw();
    el.scrollLeft = 300;
    fireEvent.scroll(el);
    fireEvent.pointerDown(el, { ...mouse, clientX: 500 });
    fireEvent.pointerMove(el, { ...mouse, clientX: 503 });
    expect(el.scrollLeft).toBe(300);
    expect(el.classList.contains("drag")).toBe(false);
  });

  it("leaves a finger to the browser", () => {
    const el = draw();
    el.scrollLeft = 300;
    fireEvent.scroll(el);
    const touch = { pointerType: "touch", pointerId: 2 };
    fireEvent.pointerDown(el, { ...touch, clientX: 500 });
    fireEvent.pointerMove(el, { ...touch, clientX: 560 });
    expect(el.scrollLeft).toBe(300);
    expect(el.classList.contains("drag")).toBe(false);
  });

  it("does not drag after the button was released outside", () => {
    const el = draw();
    el.scrollLeft = 300;
    fireEvent.scroll(el);
    fireEvent.pointerDown(el, { ...mouse, clientX: 500 });
    fireEvent.pointerMove(el, { ...mouse, clientX: 502 });
    fireEvent.pointerMove(el, { ...mouse, buttons: 0, clientX: 600 });
    expect(el.scrollLeft).toBe(300);
    expect(el.classList.contains("drag")).toBe(false);
  });

  it("stops dragging on pointercancel", () => {
    const el = draw();
    el.scrollLeft = 300;
    fireEvent.scroll(el);
    fireEvent.pointerDown(el, { ...mouse, clientX: 500 });
    fireEvent.pointerMove(el, { ...mouse, clientX: 560 });
    fireEvent.pointerCancel(el, mouse);
    expect(el.classList.contains("drag")).toBe(false);
    fireEvent.pointerMove(el, { ...mouse, clientX: 600 });
    expect(el.scrollLeft).toBe(240);
  });

  it("hides the open tooltip when a drag starts", () => {
    const el = draw();
    el.scrollLeft = 300;
    fireEvent.scroll(el);
    fireEvent.click(screen.getByText("open"));
    expect(screen.queryByRole("tooltip")).not.toBeNull();
    fireEvent.pointerDown(el, { ...mouse, clientX: 500 });
    fireEvent.pointerMove(el, { ...mouse, clientX: 560 });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("stays at the end when the width changes", () => {
    const el = draw();
    scrollWidth = 2000;
    act(() => observe());
    expect(el.scrollLeft).toBe(2000);
  });

  it("stays where the user left it when the width changes", () => {
    const el = draw();
    el.scrollLeft = 100;
    fireEvent.scroll(el);
    scrollWidth = 2500;
    act(() => observe());
    expect(el.scrollLeft).toBe(100);
  });
});
