import { describe, expect, it } from "vitest";
import {
  activeControls,
  advisorListKey,
  advisorQueryParams,
  DEFAULT_ADVISOR_QUERY,
  naturalOrder,
  orderLabel,
  parseAdvisorQuery,
  withSort,
  type AdvisorScope,
} from "@/src/trophy-advisor/query";

describe("trophy advisor query", () => {
  it("defaults to rarity, most common first", () =>
    expect(parseAdvisorQuery(new URLSearchParams())).toEqual(DEFAULT_ADVISOR_QUERY));

  it("ignores a hand-edited address", () =>
    expect(
      parseAdvisorQuery(new URLSearchParams("sort=date&order=up&rarity=epic&type=x&platform=PS3")),
    ).toEqual(DEFAULT_ADVISOR_QUERY));

  it("leaves defaults out of the address", () =>
    expect(advisorQueryParams(DEFAULT_ADVISOR_QUERY).toString()).toBe(""));

  it("round-trips a changed query", () => {
    const query = { sort: "alphabetical", order: "desc", platform: "PS4", rarity: "rare", type: "gold" } as const;
    expect(parseAdvisorQuery(advisorQueryParams(query))).toEqual(query);
    expect(advisorQueryParams(withSort(DEFAULT_ADVISOR_QUERY, "alphabetical")).toString()).toBe("sort=alphabetical");
  });

  it("gives each sort its natural order", () => {
    expect(naturalOrder("rarity")).toBe("desc");
    expect(naturalOrder("alphabetical")).toBe("asc");
    expect(withSort({ ...DEFAULT_ADVISOR_QUERY, order: "asc" }, "rarity").order).toBe("desc");
    expect(withSort(DEFAULT_ADVISOR_QUERY, "alphabetical").order).toBe("asc");
  });

  it("labels the direction", () => {
    expect(orderLabel("rarity", "desc")).toBe("Most common first");
    expect(orderLabel("rarity", "asc")).toBe("Rarest first");
    expect(orderLabel("alphabetical", "asc")).toBe("A to Z");
    expect(orderLabel("alphabetical", "desc")).toBe("Z to A");
  });

  it("counts the changed controls", () => {
    expect(activeControls(DEFAULT_ADVISOR_QUERY)).toBe(0);
    expect(activeControls(withSort(DEFAULT_ADVISOR_QUERY, "alphabetical"))).toBe(1);
    expect(
      activeControls({ ...withSort(DEFAULT_ADVISOR_QUERY, "alphabetical"), order: "desc", platform: "PS5" }),
    ).toBe(3);
  });

  it("changes the list key with the settings and the last sync", () => {
    const scope: AdvisorScope = { hideZero: false, hideUnobtainable: false, dlc: "all" };
    const key = (over: Partial<AdvisorScope> = {}, sync: unknown = 1, query = DEFAULT_ADVISOR_QUERY) =>
      advisorListKey(query, { ...scope, ...over }, sync);
    const keys = [
      key(),
      key({ dlc: "hide" }),
      key({ dlc: "only" }),
      key({ hideUnobtainable: true }),
      key({ hideZero: true }),
      key({}, 2),
      key({}, 1, withSort(DEFAULT_ADVISOR_QUERY, "alphabetical")),
    ];
    expect(new Set(keys).size).toBe(keys.length);
    expect(key()).toBe(key());
  });
});
