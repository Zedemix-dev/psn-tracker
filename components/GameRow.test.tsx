// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GameRow } from "@/components/GameRow";
import type { GameRank, GameRowData } from "@/src/games/row";

afterEach(cleanup);

const game = (g: Partial<GameRowData> = {}): GameRowData => ({
  id: "NPWR12345_00",
  name: "Magicka 2",
  platforms: ["PS4"],
  coverSrc: "/media/cover.png",
  coverIsIcon: false,
  coverTileBg: null,
  earnedTotal: 47,
  definedTotal: 47,
  counts: { platinum: [1, 1], gold: [2, 2], silver: [14, 14], bronze: [30, 30] },
  progress: 100,
  rank: "S",
  lastPlayedLine: "Last played 5 Nov 2026 | 33h 27m played",
  status: "plat-earned",
  unobtainable: null,
  ...g,
});

const bar = (c: HTMLElement) => c.querySelector<HTMLElement>(".bar")!;

describe("GameRow", () => {
  it("links to the game page", () => {
    render(<GameRow row={game({ id: "NPWR 1/2" })} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/games/NPWR%201%2F2");
  });

  it("shows name, platform badges and the trophy count line", () => {
    render(<GameRow row={game({ platforms: ["PS4", "PS5"] })} />);
    expect(screen.getByRole("heading", { name: "Magicka 2" })).toBeInTheDocument();
    expect(screen.getByText("PS4")).toHaveClass("platform");
    expect(screen.getByText("PS5")).toHaveClass("platform");
    expect(screen.getByText("47 / 47 trophies")).toBeInTheDocument();
  });

  it("renders the last played line as sibling parts", () => {
    const { container } = render(<GameRow row={game()} />);
    const meta = container.querySelectorAll(".game-meta")[1];
    const spans = [...meta.children];
    expect(spans.map((e) => e.tagName)).toEqual(["SPAN", "SPAN"]);
    expect(spans.map((e) => e.textContent)).toEqual(["Last played 5 Nov 2026", "33h 27m played"]);
    expect(meta.querySelector(".sep")).toBeNull();
    expect(container.textContent).not.toContain("|");
  });

  it("omits the third line when there is no last played line", () => {
    const { container } = render(<GameRow row={game({ lastPlayedLine: "" })} />);
    expect(container.querySelectorAll(".game-meta")).toHaveLength(1);
  });

  it("keeps a single part alone when no play time is known", () => {
    const { container } = render(<GameRow row={game({ lastPlayedLine: "Last played 5 Nov 2026" })} />);
    const meta = container.querySelectorAll(".game-meta")[1];
    expect(meta.children).toHaveLength(1);
    expect(meta.textContent).toBe("Last played 5 Nov 2026");
    expect(container.querySelector(".sep")).toBeNull();
  });

  it("shows no platinum chip when the game defines none, so only 3 chips", () => {
    const { container } = render(
      <GameRow
        row={game({
          counts: { platinum: [0, 0], gold: [1, 2], silver: [3, 4], bronze: [5, 6] },
          status: "incomplete",
        })}
      />,
    );
    const chips = container.querySelectorAll(".chip");
    expect(chips).toHaveLength(3);
    expect(container.querySelector(".chip.platinum")).toBeNull();
    expect([...chips].map((c) => c.textContent)).toEqual(["1/2", "3/4", "5/6"]);
  });

  it("shows four chips in platinum, gold, silver, bronze order", () => {
    const { container } = render(<GameRow row={game()} />);
    expect([...container.querySelectorAll(".chip")].map((c) => c.textContent)).toEqual([
      "1/1",
      "2/2",
      "14/14",
      "30/30",
    ]);
  });

  it.each<[number, GameRank, string]>([
    [27, "D", "var(--rank-d)"],
    [100, "S", "var(--rank-s)"],
    [63, "B", "var(--rank-b)"],
  ])("fills the bar of a %i%% game with the rank colour", (progress, rank, colour) => {
    const { container } = render(<GameRow row={game({ progress, rank })} />);
    const fill = bar(container).querySelector("i")!;
    expect(fill.style.background).toBe(colour);
    expect(fill.style.width).toBe(`${progress}%`);
    expect(bar(container)).not.toHaveClass("zero");
    expect(screen.getByText(`${progress}%`)).toBeInTheDocument();
  });

  it("marks the bar of a 0% game with the zero class", () => {
    const { container } = render(<GameRow row={game({ progress: 0, rank: "F" })} />);
    expect(bar(container)).toHaveClass("zero");
    expect(bar(container).querySelector("i")!.style.background).toBe("var(--rank-f)");
  });

  it("greys out the status icon when the platinum or the 100% is missing", () => {
    const { container, rerender } = render(<GameRow row={game({ status: "plat-earned" })} />);
    const status = () => container.querySelector(".status")!;
    expect(status().querySelector("img")).toHaveAttribute("src", "/icons/40-platinum.png");
    expect(status().querySelector(".miss")).toBeNull();

    rerender(<GameRow row={game({ status: "plat-missing" })} />);
    expect(status().querySelector("img")).toHaveClass("miss");

    rerender(<GameRow row={game({ status: "complete" })} />);
    expect(status().querySelector("svg.check")).not.toBeNull();
    expect(status().querySelector(".miss")).toBeNull();

    rerender(<GameRow row={game({ status: "incomplete" })} />);
    expect(status().querySelector("svg.check")).toHaveClass("miss");
  });

  it("contains the cover when it is only the trophy-list icon", () => {
    const { container, rerender } = render(<GameRow row={game()} />);
    expect(container.querySelector(".game-cover")).not.toHaveClass("icon");
    rerender(<GameRow row={game({ coverIsIcon: true })} />);
    expect(container.querySelector(".game-cover")).toHaveClass("icon");
  });

  it("shows the mark after the platform badge", () => {
    const { container } = render(
      <GameRow row={game({ unobtainable: { label: "7 unobtainable trophies", note: "Closed." } })} />,
    );
    const mark = container.querySelector(".unob")!;
    expect(mark).not.toBeNull();
    expect(mark).toHaveAttribute("aria-label", "7 unobtainable trophies Closed.");
    expect(mark.textContent).toContain("7 unobtainable trophies");
    expect(mark.textContent).toContain("Closed.");
    expect(mark).not.toHaveAttribute("tabindex");
    const platform = container.querySelector(".platform")!;
    expect(platform.compareDocumentPosition(mark) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows no mark otherwise", () => {
    const { container } = render(<GameRow row={game({ unobtainable: null })} />);
    expect(container.querySelector(".unob")).toBeNull();
  });
});

describe("game row CSS", () => {
  it("lets titles and meta lines wrap instead of truncating", () => {
    const css = readFileSync(path.resolve(import.meta.dirname, "../app/globals.css"), "utf8");
    const rule = (sel: string) => css.split("\n").find((l) => l.startsWith(`${sel}{`)) ?? "";
    for (const sel of [".game h3", ".game-meta"]) {
      expect(rule(sel), sel).not.toBe("");
      expect(rule(sel), sel).not.toMatch(/text-overflow|white-space:\s*nowrap/);
    }
    expect(rule(".game-meta")).toMatch(/flex-wrap:wrap/);
  });

  it("draws the separator as a clipped ::before of every part after the first", () => {
    const css = readFileSync(path.resolve(import.meta.dirname, "../app/globals.css"), "utf8");
    const rule = (sel: string) => css.split("\n").find((l) => l.startsWith(`${sel}{`)) ?? "";
    expect(rule(".game-meta")).toMatch(/overflow:hidden/);
    expect(rule(".game-meta")).toMatch(/gap:8px 17px/);
    expect(rule(".game-meta>span+span")).toMatch(/position:relative/);
    expect(rule(".game-meta>span+span::before")).toMatch(/left:-9px/);
    expect(css.split("\n").some((l) => l.startsWith(".game-meta .sep"))).toBe(false);
  });
});
