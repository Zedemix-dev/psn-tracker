// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IncompleteGames } from "@/components/trophy-advisor/IncompleteGames";
import type { IncompleteGame } from "@/src/trophy-advisor/load";

vi.mock("next/link", () => ({
  default: ({ href, prefetch, children, ...rest }: { href: string; prefetch?: boolean; children: ReactNode }) => (
    <a href={href} data-prefetch={String(prefetch)} {...rest}>
      {children}
    </a>
  ),
}));

const game = (over: Partial<IncompleteGame> = {}): IncompleteGame => ({
  id: "NPWR1_00",
  name: "The Game",
  platforms: ["PS5"],
  coverSrc: "/media/cover.png",
  coverIsIcon: false,
  coverTileBg: null,
  progress: 27,
  rank: "D",
  left: 1234,
  unobtainable: null,
  ...over,
});

afterEach(cleanup);

describe("IncompleteGames", () => {
  it("links each game and shows the count with 'left'", () => {
    render(<IncompleteGames games={[game(), game({ id: "NPWR2_00", name: "Other", left: 3 })]} />);
    expect(screen.getByRole("link", { name: /The Game/ })).toHaveAttribute("href", "/games/NPWR1_00");
    expect(screen.getByRole("link", { name: /Other/ })).toHaveAttribute("href", "/games/NPWR2_00");
    expect(screen.getByText("1,234")).toBeInTheDocument();
    expect(screen.getAllByText("left")).toHaveLength(2);
  });

  it("gives the bar the colour of the rank and the PSN percentage", () => {
    const { container } = render(<IncompleteGames games={[game(), game({ id: "B", progress: 0, rank: "F" })]} />);
    const fills = container.querySelectorAll<HTMLElement>(".bar i");
    expect(fills[0].style.background).toBe("var(--rank-d)");
    expect(fills[0].style.width).toBe("27%");
    expect(screen.getByText("27%")).toBeInTheDocument();
    expect(container.querySelectorAll(".bar")[0]).not.toHaveClass("zero");
    expect(container.querySelectorAll(".bar")[1]).toHaveClass("zero");
  });

  it("shows the mark only when the game has one", () => {
    const { rerender } = render(<IncompleteGames games={[game()]} />);
    expect(screen.queryByRole("img", { name: /unobtainable/ })).toBeNull();
    rerender(
      <IncompleteGames games={[game({ unobtainable: { label: "2 unobtainable trophies", note: "Servers are off." } })]} />,
    );
    expect(screen.getByRole("img", { name: "2 unobtainable trophies Servers are off." })).toBeInTheDocument();
  });

  it("puts an icon cover on its tile", () => {
    const { container } = render(<IncompleteGames games={[game({ coverIsIcon: true })]} />);
    expect(container.querySelector(".adv-game img")).toHaveClass("icon");
  });

  it("reads 41 games, 1 game, and the empty text", () => {
    const many = Array.from({ length: 41 }, (_, i) => game({ id: `G${i}` }));
    const { rerender } = render(<IncompleteGames games={many} />);
    expect(screen.getByText("41 games")).toBeInTheDocument();
    rerender(<IncompleteGames games={[game()]} />);
    expect(screen.getByText("1 game")).toBeInTheDocument();
    rerender(<IncompleteGames games={[]} />);
    expect(screen.getByText("0 games")).toBeInTheDocument();
    expect(screen.getByText("No incomplete games.")).toBeInTheDocument();
  });
});
