// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TrophyLogRow } from "@/components/trophy-log/TrophyLogRow";
import type { LogRow } from "@/src/trophy-log/load";

const row = (over: Partial<LogRow> = {}): LogRow => ({
  key: "NPWR1_00:5",
  n: 11636,
  name: "Last Light",
  detail: "Finish the game.",
  iconSrc: "/media/icon.png",
  type: "gold",
  gameId: "NPWR1_00",
  gameName: "The Game",
  gameSrc: "/media/game.png",
  gameIsIcon: false,
  dlc: null,
  platforms: ["PS5"],
  date: "9 Nov 2026",
  time: "15:46:30",
  ratePct: "4.60%",
  tier: "Ultra rare",
  unobtainable: false,
  ...over,
});

afterEach(cleanup);

describe("TrophyLogRow", () => {
  it("shows the trophy, its number, date, time and rarity", () => {
    render(<TrophyLogRow row={row()} />);
    expect(screen.getByText("Last Light")).toBeInTheDocument();
    expect(screen.getByText("#11,636")).toBeInTheDocument();
    expect(screen.getByText("9 Nov 2026")).toBeInTheDocument();
    expect(screen.getByText("15:46:30")).toBeInTheDocument();
    expect(screen.getByText("4.60%")).toBeInTheDocument();
    expect(screen.getByText("Ultra rare")).toBeInTheDocument();
    expect(screen.getByText("PS5")).toBeInTheDocument();
  });

  it("links the game image and the game name, not the row", () => {
    const { container } = render(<TrophyLogRow row={row()} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    for (const a of links) expect(a).toHaveAttribute("href", "/games/NPWR1_00");
    expect(container.firstElementChild?.tagName).toBe("DIV");
  });

  it("shows the DLC only for a DLC trophy", () => {
    const { rerender } = render(<TrophyLogRow row={row()} />);
    expect(screen.queryByText(/· Extra Pack/)).toBeNull();
    rerender(<TrophyLogRow row={row({ dlc: "Extra Pack" })} />);
    expect(screen.getByText("· Extra Pack")).toBeInTheDocument();
  });

  it("marks an unobtainable trophy", () => {
    const { rerender } = render(<TrophyLogRow row={row()} />);
    expect(screen.queryByRole("img", { name: "No longer obtainable. You already have it." })).toBeNull();
    rerender(<TrophyLogRow row={row({ unobtainable: true })} />);
    expect(screen.getByRole("img", { name: "No longer obtainable. You already have it." })).toBeInTheDocument();
  });

  it("shows no rarity when it is unknown", () => {
    const { container } = render(<TrophyLogRow row={row({ ratePct: null, tier: null })} />);
    expect(container.querySelector(".rate")).toBeEmptyDOMElement();
  });

  it("puts the list icon on its tile", () => {
    const { container, rerender } = render(<TrophyLogRow row={row()} />);
    expect(container.querySelector("img.gc")).not.toHaveClass("icon");
    rerender(<TrophyLogRow row={row({ gameIsIcon: true })} />);
    expect(container.querySelector("img.gc")).toHaveClass("icon");
  });
});
