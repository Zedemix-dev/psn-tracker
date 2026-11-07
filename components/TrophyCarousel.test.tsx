// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fitCount } from "@/components/carousel-fit";
import { TrophyCarousel, type CarouselTrophy } from "@/components/TrophyCarousel";

const desktop = { icon: 56, gap: 8, card: 380, narrow: false } as const;

describe("fitCount", () => {
  it("fits the card plus as many icons as the width allows", () => {
    expect(fitCount(1400, { ...desktop }, 20)).toBe(16);
    expect(fitCount(1232, { ...desktop }, 20)).toBe(14);
  });
  it("never exceeds the available items", () => {
    expect(fitCount(1400, { ...desktop }, 3)).toBe(3);
  });
  it("uses the full row for icons on narrow screens", () => {
    expect(fitCount(500, { ...desktop, narrow: true }, 20)).toBe(8);
  });
});

const trophies: CarouselTrophy[] = [1, 2, 3].map((n) => ({
  key: `t${n}`,
  name: `Trophy ${n}`,
  detail: `Description ${n}`,
  game: "Magicka 2",
  when: "5 Nov 2026, 00:16",
  iconSrc: "/icons/placeholder.svg",
  type: "gold",
  ratePct: n === 3 ? null : "4.50%",
  tier: n === 3 ? null : "Ultra rare",
}));

const mockMatchMedia = (reduce: boolean) =>
  vi.stubGlobal(
    "matchMedia",
    vi.fn((q: string) => ({
      matches: q.includes("prefers-reduced-motion") ? reduce : false,
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  mockMatchMedia(false);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const pressed = () => screen.getAllByRole("button").findIndex((b) => b.getAttribute("aria-pressed") === "true");

describe("<TrophyCarousel>", () => {
  it("renders nothing without trophies", () => {
    const { container } = render(<TrophyCarousel trophies={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("starts on the first trophy and shows its details", () => {
    render(<TrophyCarousel trophies={trophies} />);
    expect(pressed()).toBe(0);
    expect(screen.getByText("Description 1")).toBeInTheDocument();
    expect(screen.getByText("5 Nov 2026, 00:16 in Magicka 2")).toBeInTheDocument();
    expect(screen.getByText("Ultra rare")).toBeInTheDocument();
  });

  it("advances after 6 s and wraps", () => {
    render(<TrophyCarousel trophies={trophies} />);
    act(() => void vi.advanceTimersByTime(5999));
    expect(pressed()).toBe(0);
    act(() => void vi.advanceTimersByTime(1));
    expect(pressed()).toBe(1);
    act(() => void vi.advanceTimersByTime(6000));
    expect(pressed()).toBe(2);
    act(() => void vi.advanceTimersByTime(6000));
    expect(pressed()).toBe(0);
  });

  it("does not advance while hovered, and resumes on leave", () => {
    render(<TrophyCarousel trophies={trophies} />);
    const strip = screen.getByLabelText("Latest trophies");
    fireEvent.mouseEnter(strip);
    act(() => void vi.advanceTimersByTime(20000));
    expect(pressed()).toBe(0);
    fireEvent.mouseLeave(strip);
    act(() => void vi.advanceTimersByTime(6000));
    expect(pressed()).toBe(1);
  });

  it("does not advance while focused", () => {
    render(<TrophyCarousel trophies={trophies} />);
    fireEvent.focusIn(screen.getAllByRole("button")[0]);
    act(() => void vi.advanceTimersByTime(20000));
    expect(pressed()).toBe(0);
  });

  it("selects a trophy on click and restarts the timer", () => {
    render(<TrophyCarousel trophies={trophies} />);
    act(() => void vi.advanceTimersByTime(4000));
    fireEvent.click(screen.getAllByRole("button")[2]);
    expect(pressed()).toBe(2);
    act(() => void vi.advanceTimersByTime(5999));
    expect(pressed()).toBe(2);
    act(() => void vi.advanceTimersByTime(1));
    expect(pressed()).toBe(0);
  });

  it("still advances with prefers-reduced-motion: reduce", () => {
    mockMatchMedia(true);
    render(<TrophyCarousel trophies={trophies} />);
    act(() => void vi.advanceTimersByTime(6000));
    expect(pressed()).toBe(1);
  });

  it("shows no percentage or tier for a trophy without rate", () => {
    render(<TrophyCarousel trophies={trophies} />);
    fireEvent.click(screen.getAllByRole("button")[2]);
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});
