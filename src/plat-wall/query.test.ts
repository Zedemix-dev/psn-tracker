import { describe, expect, it } from "vitest";
import {
  applyPlatQuery,
  arePlatParamsValid,
  exportFileName,
  parsePlatQuery,
  platQueryParams,
  platinumYears,
  type PlatQuery,
  type Platinum,
} from "@/src/plat-wall/query";

const DEFAULTS: PlatQuery = { year: null, platform: "all", sort: "newest", show: ["art"] };
const plat = (o: Partial<Platinum> & { game: string }): Platinum => ({
  titleId: o.game,
  iconUrl: "x",
  earnedAt: new Date("2024-01-01T12:00:00Z"),
  rate: 10,
  platforms: ["PS5"],
  ...o,
});

describe("parsePlatQuery", () => {
  it("uses the defaults", () => expect(parsePlatQuery(new URLSearchParams())).toEqual(DEFAULTS));
  it("falls back on garbage", () =>
    expect(parsePlatQuery(new URLSearchParams("year=abc&platform=PS3&sort=foo&show=zzz"))).toEqual(DEFAULTS));
  it("orders show", () => expect(parsePlatQuery(new URLSearchParams("show=name,art")).show).toEqual(["art", "name"]));
});

describe("arePlatParamsValid", () => {
  it.each(["", "year=2026&platform=PS5&sort=rarity&show=art,rarity&download=1&t=5"])("accepts %s", (s) =>
    expect(arePlatParamsValid(new URLSearchParams(s))).toBe(true));
  it.each(["year=abc", "year=20261", "platform=PS3", "sort=foo", "show=", "show=art,zzz"])("refuses %s", (s) =>
    expect(arePlatParamsValid(new URLSearchParams(s))).toBe(false));
});

describe("platQueryParams", () => {
  it("leaves defaults out", () => expect(platQueryParams(DEFAULTS).toString()).toBe(""));
  it("writes the rest", () =>
    expect(platQueryParams({ year: 2026, platform: "PS4", sort: "rarity", show: ["art", "name"] }).toString()).toBe(
      "year=2026&platform=PS4&sort=rarity&show=art%2Cname",
    ));
});

describe("applyPlatQuery", () => {
  it("counts the year in Paris", () => {
    const p = plat({ game: "A", earnedAt: new Date("2025-12-31T23:30:00Z") });
    expect(applyPlatQuery([p], { ...DEFAULTS, year: 2026 })).toEqual([p]);
    expect(applyPlatQuery([p], { ...DEFAULTS, year: 2025 })).toEqual([]);
  });
  it("keeps a list when the platform is one of its platforms", () => {
    const a = plat({ game: "A", platforms: ["PS3", "PS4"] });
    const b = plat({ game: "B", platforms: ["PS5", "PSPC"] });
    expect(applyPlatQuery([a, b], { ...DEFAULTS, platform: "PS4" })).toEqual([a]);
    expect(applyPlatQuery([a, b], { ...DEFAULTS, platform: "PS5" })).toEqual([b]);
  });
  it("sorts rarest first, unknown rate last, newest first on a tie", () => {
    const a = plat({ game: "a", rate: 5, earnedAt: new Date("2024-01-01T00:00:00Z") });
    const b = plat({ game: "b", rate: 0.1 });
    const c = plat({ game: "c", rate: null });
    const d = plat({ game: "d", rate: 5, earnedAt: new Date("2024-06-01T00:00:00Z") });
    const out = applyPlatQuery([a, b, c, d], { ...DEFAULTS, sort: "rarity" });
    expect(out.map((p) => p.game)).toEqual(["b", "d", "a", "c"]);
  });
  it("sorts by game name ignoring case", () => {
    const out = applyPlatQuery([plat({ game: "gamma" }), plat({ game: "Beta" }), plat({ game: "alpha" })], {
      ...DEFAULTS,
      sort: "alphabetical",
    });
    expect(out.map((p) => p.game)).toEqual(["alpha", "Beta", "gamma"]);
  });
  it("sorts newest first", () => {
    const old = plat({ game: "old", earnedAt: new Date("2020-01-01T00:00:00Z") });
    const recent = plat({ game: "recent", earnedAt: new Date("2024-01-01T00:00:00Z") });
    expect(applyPlatQuery([old, recent], DEFAULTS).map((p) => p.game)).toEqual(["recent", "old"]);
  });
  it("does not mutate its input", () => {
    const input = [plat({ game: "a", rate: 9 }), plat({ game: "b", rate: 1 })];
    applyPlatQuery(input, { ...DEFAULTS, sort: "rarity" });
    expect(input.map((p) => p.game)).toEqual(["a", "b"]);
  });
});

describe("platinumYears", () => {
  it("lists years once, newest first", () =>
    expect(
      platinumYears([
        plat({ game: "a", earnedAt: new Date("2021-05-01T00:00:00Z") }),
        plat({ game: "b", earnedAt: new Date("2026-05-01T00:00:00Z") }),
        plat({ game: "c", earnedAt: new Date("2021-07-01T00:00:00Z") }),
      ]),
    ).toEqual([2026, 2021]));
});

describe("exportFileName", () => {
  it("names the file", () => {
    expect(exportFileName("Zmx969", DEFAULTS)).toBe("Zmx969-plat-wall.png");
    expect(exportFileName("Zmx969", { ...DEFAULTS, year: 2026, platform: "PS5", sort: "rarity", show: ["name"] })).toBe(
      "Zmx969-plat-wall-2026-PS5.png",
    );
    expect(exportFileName('Zm"x/9', DEFAULTS)).toBe("Zmx9-plat-wall.png");
  });
});
