// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StatsPanels } from "@/components/stats/StatsPanels";
import { stubMeasure } from "@/components/stats/test-utils";
import type { StatsData } from "@/src/stats/load";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const data = (over: Partial<StatsData> = {}): StatsData => ({
  total: 1200,
  calendar: { weeks: [], months: [], summary: { trophies: 515, platinums: 3, bestDay: null, streak: null } },
  rarity: { tiers: { "Ultra rare": 10, "Very rare": 20, Rare: 30, Uncommon: 40, Common: 50 }, average: 26.55 },
  points: { platinum: 1000, gold: 2000, silver: 3000, bronze: 4000 },
  totalPoints: 350850,
  counts: { platinum: 3, gold: 2, silver: 1, bronze: 4 },
  months: [
    { label: "Jan 26", title: "Jan 2026", trophies: 5, platinum: 1, gold: 1, silver: 1, bronze: 2 },
    { label: "Feb 26", title: "Feb 2026", trophies: 7, platinum: 1, gold: 1, silver: 2, bronze: 3 },
  ],
  hours: Array.from({ length: 24 }, (_, i) => i),
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  games: 266,
  completion: { buckets: [100, 60, 50, 40, 16], average: 94.17 },
  platforms: { PS5: 100, PS4: 166 },
  years: [
    { year: 2014, games: 2 },
    { year: 2015, games: 0 },
    { year: 2016, games: 4 },
  ],
  noYear: 25,
  publishers: [
    { name: "Sony", games: 30 },
    { name: "Capcom", games: 12 },
  ],
  otherPublishers: { names: 48, games: 60 },
  noPublisher: 6,
  genres: [{ name: "Action", games: 90 }],
  noGenre: 6,
  levels: [],
  ...over,
});
const draw = (d: StatsData) => {
  stubMeasure(832);
  return render(<StatsPanels data={d} />);
};

describe("<StatsPanels>", () => {
  it("renders the panels in the order of the spec", () => {
    const { container } = draw(data());
    const titles = [...container.querySelectorAll("h2")].map((h) => h.textContent);
    expect(titles).toEqual([
      "Last 12 months",
      "Rarity",
      "Completion",
      "PSN points",
      "Platforms",
      "Monthly activity",
      "Trophy progression",
      "Trophies by time",
      "Trophies by day",
      "Games by release year",
      "Games by publisher",
      "Games by genre",
      "Level history",
    ]);
    expect(container.querySelector(".st-donuts")!.querySelectorAll("section")).toHaveLength(4);
    expect(container.querySelector(".st-row-2")!.querySelectorAll("h2")).toHaveLength(2);
    expect(container.querySelector(".st-row-3")!.querySelectorAll("h2")).toHaveLength(3);
    expect(container).toHaveTextContent("Paris time");
  });

  it("shows the center values", () => {
    const { container } = draw(data());
    const text = container.querySelector(".st-donuts")!.textContent!;
    for (const v of ["26.55%", "94.17%", "350,850", "266"]) expect(text).toContain(v);
  });

  it("lists the platforms without Multiplatform", () => {
    const { container } = draw(data());
    const platforms = within(container.querySelectorAll<HTMLElement>(".st-donuts section")[3]);
    expect(platforms.getByText("PS5")).toBeInTheDocument();
    expect(platforms.getByText("PS4")).toBeInTheDocument();
    expect(platforms.queryByText(/Multiplatform/)).toBeNull();
  });

  it("adds Other (48) after the publishers, and only when there are other publishers", () => {
    const { container, rerender } = draw(data());
    const names = () => [...container.querySelectorAll(".st-row-3 .st-bars")[0].querySelectorAll(".n")].map((n) => n.textContent);
    expect(names()).toEqual(["Sony", "Capcom", "Other (48)"]);
    rerender(<StatsPanels data={data({ otherPublishers: { names: 0, games: 0 } })} />);
    expect(names()).toEqual(["Sony", "Capcom"]);
  });

  it("writes the notes, and drops one whose number is 0", () => {
    const { container, rerender } = draw(data());
    const row = () => container.querySelector(".st-row-3")!;
    expect(row()).toHaveTextContent("25 games have no release date on PSN.");
    expect(row()).toHaveTextContent("6 games have no publisher on PSN.");
    expect(row()).toHaveTextContent("A game can have several genres. 6 have none on PSN.");
    rerender(<StatsPanels data={data({ noYear: 1, noPublisher: 0, noGenre: 0 })} />);
    expect(row()).toHaveTextContent("1 game has no release date on PSN.");
    expect(row().textContent).not.toMatch(/no publisher/);
    expect(row()).toHaveTextContent("A game can have several genres.");
    expect(row().textContent).not.toMatch(/have none/);
    rerender(<StatsPanels data={data({ noYear: 0 })} />);
    expect(row().textContent).not.toMatch(/no release date/);
  });

  it("labels the hour and day charts", () => {
    const { container } = draw(data());
    const row2 = container.querySelector(".st-row-2")!;
    const texts = [...row2.querySelectorAll("svg text")].map((t) => t.textContent);
    expect(texts).toContain("00");
    expect(texts).toContain("23");
    expect(texts).toContain("Mon");
    expect(texts).toContain("Sun");
  });

  it("shows only the note in a games panel with no data", () => {
    const { container } = draw(data({ years: [], publishers: [], otherPublishers: { names: 0, games: 0 }, genres: [] }));
    const panels = container.querySelectorAll(".st-row-3 section");
    expect(panels[0].querySelector("svg")).toBeNull();
    expect(panels[0]).toHaveTextContent("25 games have no release date on PSN.");
    expect(panels[1].querySelector(".st-bars")).toBeNull();
    expect(panels[2].querySelector(".st-bars")).toBeNull();
  });

  it("draws the release years", () => {
    const { container } = draw(data());
    const texts = [...container.querySelectorAll(".st-row-3 section")[0].querySelectorAll("svg text")].map((t) => t.textContent);
    expect(texts).toEqual(expect.arrayContaining(["'14", "'15", "'16"]));
  });

  it("shows No trophies yet. alone when nothing is earned", () => {
    const { container } = draw(data({ total: 0 }));
    expect(container.querySelectorAll("section")).toHaveLength(1);
    expect(container.querySelector("section.st-empty")).toHaveTextContent("No trophies yet.");
    expect(container.querySelector("h2")).toBeNull();
  });
});
