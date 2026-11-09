// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameFilters } from "@/components/GameFilters";
import type { GameQuery } from "@/src/games/query";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const query = (q: string): GameQuery => ({ state: "all", platform: "all", sort: "lastTrophy", q, unobtainable: "off", offset: 0 });
const input = () => screen.getByPlaceholderText("Search games") as HTMLInputElement;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  replace.mockReset();
});

describe("GameFilters sort menu", () => {
  it("lists Last trophy first and selects it by default", () => {
    render(<GameFilters query={query("")} />);
    const select = screen.getByLabelText("Sort by") as HTMLSelectElement;
    expect(select.options[0].textContent).toBe("Last trophy");
    expect(select.options[1].textContent).toBe("Last played");
    expect(select.value).toBe("lastTrophy");
  });
});

describe("GameFilters search", () => {
  it("replaces the URL 300 ms after typing", () => {
    render(<GameFilters query={query("")} />);
    fireEvent.change(input(), { target: { value: "gris" } });
    act(() => void vi.advanceTimersByTime(299));
    expect(replace).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1));
    expect(replace).toHaveBeenCalledWith("/?q=gris", { scroll: false });
  });

  it("follows Back: the input is reset and the stale search is not pushed again", () => {
    const { rerender } = render(<GameFilters query={query("")} />);
    fireEvent.change(input(), { target: { value: "gris" } });
    act(() => void vi.advanceTimersByTime(300));
    expect(replace).toHaveBeenCalledTimes(1);
    rerender(<GameFilters query={query("gris")} />); // our own navigation landed
    replace.mockClear();

    rerender(<GameFilters query={query("")} />); // Back
    act(() => void vi.advanceTimersByTime(1000));
    expect(input().value).toBe("");
    expect(replace).not.toHaveBeenCalled();

    rerender(<GameFilters query={query("gris")} />); // Forward
    act(() => void vi.advanceTimersByTime(1000));
    expect(input().value).toBe("gris");
    expect(replace).not.toHaveBeenCalled();
  });

  it("resets the input when the page starts on another search", () => {
    const { rerender } = render(<GameFilters query={query("gris")} />);
    rerender(<GameFilters query={query("")} />);
    act(() => void vi.advanceTimersByTime(1000));
    expect(input().value).toBe("");
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("GameFilters unobtainable filter", () => {
  const select = () => screen.getByLabelText("Filter by unobtainable trophies") as HTMLSelectElement;

  it("lists the three values", () => {
    render(<GameFilters query={query("")} />);
    expect([...select().options].map((o) => o.textContent)).toEqual([
      "Unobtainable",
      "With unobtainable",
      "Without unobtainable",
    ]);
  });

  it("sits between the sort menu and the search", () => {
    render(<GameFilters query={query("")} />);
    const sort = screen.getByLabelText("Sort by");
    expect(sort.compareDocumentPosition(select()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(select().compareDocumentPosition(input()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("puts the value in the address", () => {
    render(<GameFilters query={query("")} />);
    fireEvent.change(select(), { target: { value: "with" } });
    expect(replace).toHaveBeenCalledWith("/?unobtainable=with", { scroll: false });
  });

  it("outlines the select only when active", () => {
    const { rerender } = render(<GameFilters query={query("")} />);
    expect(select()).not.toHaveClass("on");
    rerender(<GameFilters query={{ ...query(""), unobtainable: "with" }} />);
    expect(select()).toHaveClass("on");
  });
});
