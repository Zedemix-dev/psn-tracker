import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOG_QUERY, LOG_MAX, LOG_ORDERS, LOG_PLATFORMS, LOG_RARITIES, LOG_SORTS, LOG_TYPES,
  activeControls, isFiltered, logQueryParams, orderLabel, parseLogQuery, parsePaging, shownText, tierOf, withSort,
  type LogQuery,
} from "@/src/trophy-log/query";

describe("trophy log query", () => {
  it("uses the defaults", () => expect(parseLogQuery(new URLSearchParams())).toEqual(DEFAULT_LOG_QUERY));
  it("falls back on garbage", () =>
    expect(parseLogQuery(new URLSearchParams("sort=foo&order=up&platform=PS3&rarity=epic&type=x"))).toEqual(DEFAULT_LOG_QUERY));
  it("takes the natural order of the sort", () =>
    expect(parseLogQuery(new URLSearchParams("sort=alphabetical")).order).toBe("asc"));
  it("leaves the defaults and the natural order out", () => {
    expect(logQueryParams(DEFAULT_LOG_QUERY).toString()).toBe("");
    expect(logQueryParams({ ...DEFAULT_LOG_QUERY, sort: "rarity", order: "asc" }).toString()).toBe("sort=rarity");
    expect(logQueryParams({ ...DEFAULT_LOG_QUERY, sort: "rarity", order: "desc", type: "gold" }).toString())
      .toBe("sort=rarity&order=desc&type=gold");
  });
  it("round-trips every combination", () => {
    for (const sort of LOG_SORTS) for (const order of LOG_ORDERS) for (const platform of LOG_PLATFORMS)
      for (const rarity of LOG_RARITIES) for (const type of LOG_TYPES) {
        const q: LogQuery = { sort, order, platform, rarity, type };
        expect(parseLogQuery(logQueryParams(q))).toEqual(q);
      }
  });
  it("labels the six orders", () => {
    expect(orderLabel("date", "desc")).toBe("Newest first");
    expect(orderLabel("date", "asc")).toBe("Oldest first");
    expect(orderLabel("alphabetical", "asc")).toBe("A to Z");
    expect(orderLabel("alphabetical", "desc")).toBe("Z to A");
    expect(orderLabel("rarity", "asc")).toBe("Rarest first");
    expect(orderLabel("rarity", "desc")).toBe("Most common first");
  });
  it("resets the order when the sort changes", () => {
    expect(withSort({ ...DEFAULT_LOG_QUERY, sort: "alphabetical", order: "desc" }, "date").order).toBe("desc");
    expect(withSort({ ...DEFAULT_LOG_QUERY, order: "asc" }, "rarity").order).toBe("asc");
  });
  it("counts the changed controls", () => {
    expect(activeControls(DEFAULT_LOG_QUERY)).toBe(0);
    expect(activeControls(withSort(DEFAULT_LOG_QUERY, "alphabetical"))).toBe(1);
    expect(activeControls({ ...withSort(DEFAULT_LOG_QUERY, "alphabetical"), order: "desc", platform: "PS5" })).toBe(3);
    expect(activeControls({ ...DEFAULT_LOG_QUERY, order: "asc" })).toBe(1);
  });
  it("tells whether a filter is on", () => {
    expect(isFiltered(DEFAULT_LOG_QUERY)).toBe(false);
    expect(isFiltered({ ...DEFAULT_LOG_QUERY, sort: "rarity", order: "asc" })).toBe(false);
    expect(isFiltered({ ...DEFAULT_LOG_QUERY, type: "gold" })).toBe(true);
  });
  it("maps the rarity filters to tiers", () => {
    expect(tierOf("ultra-rare")).toBe("Ultra rare");
    expect(tierOf("very-rare")).toBe("Very rare");
    expect(tierOf("common")).toBe("Common");
  });
  it("reads the paging", () => {
    expect(parsePaging(new URLSearchParams("offset=-3&limit=0"))).toEqual({ offset: 0, limit: 50 });
    expect(parsePaging(new URLSearchParams("offset=50&limit=120"))).toEqual({ offset: 50, limit: 120 });
    expect(parsePaging(new URLSearchParams("limit=999999"))).toEqual({ offset: 0, limit: 50 });
    expect(parsePaging(new URLSearchParams("offset=50&all=1"))).toEqual({ offset: 50, limit: LOG_MAX });
    expect(parsePaging(new URLSearchParams("offset=abc&limit=1.5"))).toEqual({ offset: 0, limit: 50 });
  });
  it("words the count", () => {
    expect(shownText(11636, 11636, false)).toBe("11,636 trophies");
    expect(shownText(1, 1, false)).toBe("1 trophy");
    expect(shownText(11636, 1234, true)).toBe("1,234 of 11,636 trophies match");
  });
});
