// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameFilters } from "@/components/GameFilters";
import type { GameQuery } from "@/src/games/query";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const query = (q: string): GameQuery => ({ state: "all", platform: "all", sort: "lastPlayed", q, offset: 0 });
const input = () => screen.getByPlaceholderText("Search games") as HTMLInputElement;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  replace.mockReset();
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
