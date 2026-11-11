// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChartTipProvider } from "@/components/stats/ChartTip";
import { LevelHistory } from "@/components/stats/LevelHistory";
import { stubMeasure } from "@/components/stats/test-utils";
import { levelSpriteStyle } from "@/components/levelSprite";
import type { LevelRow } from "@/src/stats/load";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const row = (level: number, over: Partial<LevelRow> = {}): LevelRow => ({
  key: `T${level}:1`,
  level,
  tier: Math.min(10, Math.floor(level / 100) + 1),
  earnedAtMs: Date.UTC(2021, 5, 1) + level * 86_400_000,
  name: `Trophy ${level}`,
  detail: `Do thing ${level}`,
  iconSrc: `/media/icon-${level}.png`,
  type: "gold",
  gameId: `NPWR${level}`,
  gameName: `Game ${level}`,
  gameSrc: `/media/game-${level}.png`,
  gameIsIcon: false,
  date: "9 Nov 2026",
  time: "15:46:30",
  ratePct: "18.30%",
  rarity: "Rare",
  ...over,
});
/** Newest first, as the loader returns them. */
const rows = [row(530), row(520), row(510)];
const draw = (levels: LevelRow[]) =>
  render(
    <ChartTipProvider>
      <LevelHistory levels={levels} />
    </ChartTipProvider>,
  );

describe("<LevelHistory>", () => {
  it("draws a point per level", () => {
    stubMeasure(832);
    const { container, getByRole } = draw(rows);
    expect(getByRole("heading", { name: "Level history" })).toBeInTheDocument();
    expect(container).toHaveTextContent("A point every 10 levels");
    expect(container.querySelectorAll("circle.pt")).toHaveLength(3);
    expect((container.querySelector(".st-chart") as HTMLElement).style.minHeight).toBe("252px");
  });

  it("has no NaN with a single level", () => {
    stubMeasure(832);
    const { container } = draw([row(10)]);
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
    expect(container.querySelectorAll("circle.pt")).toHaveLength(1);
  });

  it("puts a tick on each 1 January after the start", () => {
    stubMeasure(832);
    const { container } = draw([
      row(520, { earnedAtMs: Date.UTC(2023, 2, 1) }),
      row(510, { earnedAtMs: Date.UTC(2021, 5, 1) }),
    ]);
    const years = [...container.querySelectorAll("svg text")]
      .map((t) => t.textContent ?? "")
      .filter((t) => /^20\d\d$/.test(t));
    expect(years).toEqual(["2022", "2023"]);
  });

  it("shows the level, the date and the trophy of the nearest point", () => {
    stubMeasure(832);
    const { container } = draw(rows);
    const hit = container.querySelector("rect.hit") as Element;
    fireEvent.pointerMove(hit, { clientX: 2000, clientY: 50 });
    const tip = document.body.querySelector(".st-tip") as HTMLElement;
    expect(tip).toHaveTextContent("9 Nov 2026");
    expect(tip).toHaveTextContent("Level 530");
    expect(tip).toHaveTextContent("Trophy 530");
    expect(container.querySelector("circle.hl")).toBeInTheDocument();
    fireEvent.pointerLeave(hit);
    expect(document.body.querySelector(".st-tip")).toBeNull();
  });

  it("shows each row: images, name, description, game, level, date, time, rarity, type", () => {
    stubMeasure(832);
    const { container } = draw([row(530, { gameIsIcon: true })]);
    const r = container.querySelector(".st-lrow") as HTMLElement;
    expect(r.querySelector("img.gc")).toHaveAttribute("src", "/media/game-530.png");
    expect(r.querySelector("img.gc")).toHaveClass("icon");
    expect(r.querySelector("img.ic")).toHaveAttribute("src", "/media/icon-530.png");
    expect(r.querySelector(".nm")).toHaveTextContent("Trophy 530");
    expect(r.querySelector(".ds")).toHaveTextContent("Do thing 530");
    expect(r.querySelector(".g")).toHaveTextContent("Game 530");
    expect(r.querySelector(".st-lv b")).toHaveTextContent("530");
    expect(r.querySelector(".st-dt b")).toHaveTextContent("9 Nov 2026");
    expect(r.querySelector(".st-dt")).toHaveTextContent("15:46:30");
    expect(r.querySelector(".st-rt b")).toHaveTextContent("18.30%");
    expect(r.querySelector(".st-rt")).toHaveTextContent("Rare");
    const ty = r.querySelector(".st-ty") as HTMLElement;
    expect(ty.querySelector("img")).toHaveAttribute("src", "/icons/40-gold.png");
    expect(ty.querySelector("img")).toHaveAttribute("width", "30");
    expect(ty).toHaveTextContent("Gold");
  });

  it("leaves the rarity empty when the trophy has none", () => {
    stubMeasure(832);
    const { container } = draw([row(530, { ratePct: null, rarity: null })]);
    expect(container.querySelector(".st-rt")).toBeEmptyDOMElement();
  });

  it("lists the rows from the newest to the oldest", () => {
    stubMeasure(832);
    const { container } = draw(rows);
    expect([...container.querySelectorAll(".st-lrow .nm")].map((n) => n.textContent)).toEqual([
      "Trophy 530", "Trophy 520", "Trophy 510",
    ]);
  });

  it("links the image and the name of the game, not the row", () => {
    stubMeasure(832);
    const { container } = draw([row(530, { gameId: "NPWR 1/2" })]);
    const r = container.querySelector(".st-lrow") as HTMLElement;
    expect(r.tagName).toBe("DIV");
    const links = [...r.querySelectorAll("a")];
    expect(links).toHaveLength(2);
    for (const a of links) expect(a).toHaveAttribute("href", "/games/NPWR%201%2F2");
    expect(links[0].querySelector("img.gc")).not.toBeNull();
    expect(links[1]).toHaveTextContent("Game 530");
  });

  it("gives the level icon its tier", () => {
    stubMeasure(832);
    const { container } = draw([row(530)]);
    const sp = container.querySelector(".st-lv .sp") as HTMLElement;
    const expected = Object.assign(document.createElement("div").style, levelSpriteStyle(6)).backgroundPosition;
    expect(sp.style.backgroundPosition).toBe(expected);
    expect(sp.style.backgroundPosition).not.toBe(Object.assign(document.createElement("div").style, levelSpriteStyle(1)).backgroundPosition);
  });

  it("draws no chart without a level", () => {
    stubMeasure(832);
    const { container, getByRole } = draw([]);
    expect(getByRole("heading", { name: "Level history" })).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
    expect(container.querySelector(".st-lrow")).toBeNull();
  });
});
