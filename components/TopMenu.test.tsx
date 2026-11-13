// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TopMenu } from "@/components/TopMenu";

let path = "/";
vi.mock("next/navigation", () => ({ usePathname: () => path }));

const SIZES: Record<string, [number, number]> = {
  Games: [0, 74],
  "Plat Wall": [80, 85],
  "Trophy Log": [171, 102],
  "Trophy Advisor": [279, 129],
  Stats: [414, 63],
};

let clientWidth = 293;
let resize: () => void = () => {};

beforeEach(() => {
  path = "/";
  clientWidth = 293;
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(() => 477);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => clientWidth);
  vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(function (this: HTMLElement) {
    return SIZES[this.textContent ?? ""]?.[0] ?? 0;
  });
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (this: HTMLElement) {
    return SIZES[this.textContent ?? ""]?.[1] ?? 0;
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(cb: () => void) {
        resize = cb;
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

const nav = () => screen.getByRole("navigation", { name: "Pages" });

describe("TopMenu", () => {
  it("opens on /stats with the Stats tab in view", () => {
    path = "/stats";
    render(<TopMenu />);
    expect(nav().scrollLeft).toBe(184);
    expect(nav()).toHaveClass("fl");
    expect(nav()).not.toHaveClass("fr");
  });

  it("stays at the start on /", () => {
    render(<TopMenu />);
    expect(nav().scrollLeft).toBe(0);
    expect(nav()).toHaveClass("fr");
    expect(nav()).not.toHaveClass("fl");
  });

  it("follows a scroll", () => {
    render(<TopMenu />);
    nav().scrollLeft = 90;
    fireEvent.scroll(nav());
    expect(nav()).toHaveClass("fl");
    expect(nav()).toHaveClass("fr");
  });

  it("follows a resize", () => {
    render(<TopMenu />);
    clientWidth = 600;
    act(() => resize());
    expect(nav()).not.toHaveClass("fl");
    expect(nav()).not.toHaveClass("fr");
  });

  it("names the Settings link", () => {
    path = "/settings";
    render(<TopMenu />);
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("aria-current", "page");
  });
});
