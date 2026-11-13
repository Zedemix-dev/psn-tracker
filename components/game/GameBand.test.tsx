// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GameBand } from "@/components/game/GameBand";
import type { GameDetail } from "@/src/games/detail";

afterEach(cleanup);

const detail = (metaParts: string[]) =>
  ({
    name: "Magicka 2",
    platforms: ["PS4"],
    metaParts,
    counts: { platinum: [1, 1], gold: [2, 2], silver: [14, 14], bronze: [30, 30] },
    progress: 100,
    rank: "S",
    status: "plat-earned",
  }) as unknown as GameDetail;

describe("GameBand", () => {
  it("renders the meta parts as sibling spans without separator element", () => {
    const { container } = render(<GameBand detail={detail(["47 of 47 trophies", "Last played 5 Nov 2026", "33h 27m played"])} />);
    const meta = container.querySelector(".gmeta")!;
    expect([...meta.children].map((e) => e.tagName)).toEqual(["SPAN", "SPAN", "SPAN"]);
    expect(meta.querySelector(".sep")).toBeNull();
  });

  it("keeps a single part alone", () => {
    const { container } = render(<GameBand detail={detail(["47 of 47 trophies"])} />);
    expect(container.querySelector(".gmeta")!.children).toHaveLength(1);
  });
});

describe("game page CSS", () => {
  it("draws the separator as a clipped ::before of every part after the first", () => {
    const css = readFileSync(path.resolve(import.meta.dirname, "../../app/styles/game.css"), "utf8");
    const rule = (sel: string) => css.split("\n").find((l) => l.startsWith(`${sel}{`)) ?? "";
    expect(rule(".game-page .gmeta")).toMatch(/overflow:hidden/);
    expect(rule(".game-page .gmeta")).toMatch(/gap:8px 17px/);
    expect(rule(".game-page .gmeta>span+span")).toMatch(/position:relative/);
    expect(rule(".game-page .gmeta>span+span::before")).toMatch(/left:-9px/);
    expect(css.split("\n").some((l) => l.startsWith(".game-page .sep"))).toBe(false);
  });
});
