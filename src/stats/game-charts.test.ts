import { describe, expect, it } from "vitest";
import type { GameTitle } from "@/src/games/row";
import { gameKey, type SiblingIndex } from "@/src/games/siblings";
import { buildGameCharts } from "./game-charts";

let seq = 0;
function g(over: Partial<GameTitle> = {}): GameTitle {
  seq += 1;
  return {
    npCommunicationId: `NP${seq}`,
    name: `Game ${seq}`,
    platforms: ["PS5"],
    progress: 0,
    publisher: null,
    genres: null,
    releaseDate: null,
    lastPlayedAt: null,
    coverUrl: null,
    bannerUrl: null,
    logoUrl: null,
    iconUrl: "",
    ...over,
  } as GameTitle;
}
function index(...titles: GameTitle[]): SiblingIndex {
  const m: SiblingIndex = new Map();
  for (const t of titles) m.set(gameKey(t.name) + t.npCommunicationId, [t]);
  return m;
}
const build = (...titles: GameTitle[]) => buildGameCharts(titles, index(...titles));
const year = (y: number) => new Date(Date.UTC(y, 5, 15));

describe("buildGameCharts", () => {
  it("puts each game in its completion bucket", () => {
    const c = build(...[100, 80, 79, 60, 59, 40, 39, 20, 19, 0].map((progress) => g({ progress })));
    expect(c.completion.buckets).toEqual([2, 2, 2, 2, 2]);
    expect(c.games).toBe(10);
  });

  it("averages the progress of the games", () => {
    expect(build(g({ progress: 100 }), g({ progress: 50 })).completion.average).toBe(75);
  });

  it.each([
    [["PS5"], "PS5"],
    [["PS5", "PSPC"], "PS5"],
    [["PS4"], "PS4"],
    [["PS3", "PSVITA", "PS4"], "PS4"],
    [["PSVITA", "PS4"], "PS4"],
  ])("counts %j as %s", (platforms, expected) => {
    const c = build(g({ platforms }));
    expect(c.platforms).toEqual({ PS5: expected === "PS5" ? 1 : 0, PS4: expected === "PS4" ? 1 : 0 });
  });

  it("borrows a missing date, publisher and genres from another version", () => {
    const ps5 = g({ name: "Same", platforms: ["PS5"], publisher: "Pub", genres: ["Action"], releaseDate: year(2020) });
    const ps4 = g({ name: "Same", platforms: ["PS4"] });
    const idx: SiblingIndex = new Map([[gameKey("Same"), [ps5, ps4]]]);
    const c = buildGameCharts([ps4], idx);
    expect(c.years).toEqual([{ year: 2020, games: 1 }]);
    expect(c.publishers).toEqual([{ name: "Pub", games: 1 }]);
    expect(c.genres).toEqual([{ name: "Action", games: 1 }]);
    expect(c.noYear + c.noPublisher + c.noGenre).toBe(0);
  });

  it("keeps an empty year between two years at 0", () => {
    const c = build(g({ releaseDate: year(2015) }), g({ releaseDate: year(2017) }));
    expect(c.years).toEqual([
      { year: 2015, games: 1 },
      { year: 2016, games: 0 },
      { year: 2017, games: 1 },
    ]);
  });

  it("counts games without a date, a publisher or genres", () => {
    const c = build(g(), g({ publisher: "P", genres: [], releaseDate: year(2020) }));
    expect(c.noYear).toBe(1);
    expect(c.noPublisher).toBe(1);
    expect(c.noGenre).toBe(2);
  });

  it("merges two raw names with the same display name", () => {
    const c = build(g({ publisher: "CE EUROPE LIMITED" }), g({ publisher: "Capcom" }));
    expect(c.publishers).toEqual([{ name: "Capcom", games: 2 }]);
  });

  it("keeps the top 15 publishers and groups the rest", () => {
    const titles: GameTitle[] = [];
    for (let i = 0; i < 17; i++) {
      const n = 17 - i; // 17..1 games
      for (let k = 0; k < n; k++) titles.push(g({ publisher: `Pub ${String(i).padStart(2, "0")}` }));
    }
    const c = build(...titles);
    expect(c.publishers).toHaveLength(15);
    expect(c.publishers[0]).toEqual({ name: "Pub 00", games: 17 });
    expect(c.otherPublishers).toEqual({ names: 2, games: 3 });
  });

  it("breaks ties in alphabetical order", () => {
    const c = build(g({ publisher: "Zed", genres: ["Race"] }), g({ publisher: "Alpha", genres: ["Arcade"] }));
    expect(c.publishers.map((p) => p.name)).toEqual(["Alpha", "Zed"]);
    expect(c.genres.map((p) => p.name)).toEqual(["Arcade", "Race"]);
  });

  it("breaks ties alphabetically, not by byte order", () => {
    const c = build(g({ publisher: "TMG Studios" }), g({ publisher: "Team17" }));
    expect(c.publishers.map((p) => p.name)).toEqual(["Team17", "TMG Studios"]);
  });

  it("counts a game in each of its genres", () => {
    const c = build(g({ genres: ["Action", "RPG"] }), g({ genres: ["Action"] }));
    expect(c.genres).toEqual([
      { name: "Action", games: 2 },
      { name: "RPG", games: 1 },
    ]);
    expect(c.noGenre).toBe(0);
  });

  it("returns empty lists when no game has any information", () => {
    const c = build(g(), g());
    expect(c.years).toEqual([]);
    expect(c.publishers).toEqual([]);
    expect(c.genres).toEqual([]);
    expect(c.otherPublishers).toEqual({ names: 0, games: 0 });
    expect([c.noYear, c.noPublisher, c.noGenre]).toEqual([2, 2, 2]);
  });
});
