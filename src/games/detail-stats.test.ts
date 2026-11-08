import { describe, expect, it } from "vitest";
import type { TrophyType } from "../db/schema";
import { buildTimeline, groupProgress, pointsOf, rarityBreakdownOf, rarityStats, typeCounts } from "./detail-stats";

const mk = (type: TrophyType, n: number, earned: number) =>
  Array.from({ length: n }, (_, i) => ({ type, earned: i < earned }));

describe("groupProgress", () => {
  it("weights trophies by points", () => {
    expect(groupProgress(mk("bronze", 13, 2))).toBe(15);
    expect(groupProgress(mk("bronze", 144, 1))).toBe(1);
  });
  it("floors instead of rounding up", () => {
    expect(groupProgress([...mk("bronze", 39, 38), ...mk("silver", 1, 1)])).toBe(97);
    expect(groupProgress(mk("bronze", 200, 199))).toBe(99);
  });
  it("excludes the platinum from the percentage", () => {
    expect(groupProgress([...mk("platinum", 1, 0), ...mk("gold", 2, 2), ...mk("bronze", 5, 5)])).toBe(100);
    expect(groupProgress([...mk("platinum", 1, 1), ...mk("bronze", 4, 0)])).toBe(0);
    expect(groupProgress(mk("platinum", 1, 1))).toBe(0);
  });
  it("handles all and none", () => {
    const all = [...mk("platinum", 1, 1), ...mk("gold", 2, 2), ...mk("bronze", 5, 5)];
    expect(groupProgress(all)).toBe(100);
    expect(groupProgress(mk("silver", 4, 0))).toBe(0);
    expect(groupProgress([])).toBe(0);
  });
});

describe("pointsOf", () => {
  it("sums defined and earned points", () => {
    const t = [...mk("platinum", 1, 1), ...mk("gold", 1, 1), ...mk("silver", 17, 17), ...mk("bronze", 39, 28)];
    expect(pointsOf(t)).toEqual({ total: 1485, earned: 1320 });
  });
});

describe("typeCounts", () => {
  it("counts earned and defined per type", () => {
    const c = typeCounts([...mk("gold", 3, 1), ...mk("bronze", 2, 2)]);
    expect(c.gold).toEqual([1, 3]);
    expect(c.bronze).toEqual([2, 2]);
    expect(c.platinum).toEqual([0, 0]);
    expect(c.silver).toEqual([0, 0]);
  });
});

describe("rarityStats", () => {
  it("computes stats ignoring nulls", () => {
    const s = rarityStats([79.7, null, 2.3, 11.9])!;
    expect(s.average).toBeCloseTo(31.3, 5);
    expect(s.lowest).toBe(2.3);
    expect(s.median).toBe(11.9);
    expect(s.highest).toBe(79.7);
  });
  it("returns null without rates", () => {
    expect(rarityStats([null])).toBeNull();
  });
  it("averages the two middle values for an even count", () => {
    expect(rarityStats([1, 2, 3, 10])!.median).toBe(2.5);
  });
});

describe("rarityBreakdownOf", () => {
  it("counts per tier", () => {
    expect(rarityBreakdownOf([2.3, 7, 15, 30, 60, null])).toEqual({
      "Ultra rare": 1,
      "Very rare": 1,
      Rare: 1,
      Uncommon: 1,
      Common: 1,
    });
  });
});

describe("buildTimeline", () => {
  const now = new Date("2026-11-08T12:00:00Z");
  it("returns one row without trophies", () => {
    expect(buildTimeline([], true, now)).toEqual([
      { label: "No trophy earned yet", note: null, date: null, time: null },
    ]);
  });
  it("shows an unearned platinum", () => {
    const rows = buildTimeline([{ type: "bronze", earnedAt: new Date("2022-07-06T20:10:57Z") }], true, now);
    expect(rows.map((r) => r.label)).toEqual(["First trophy", "Platinum", "Latest trophy", "Gap"]);
    expect(rows[1]).toEqual({ label: "Platinum", note: "Not earned yet", date: "—", time: null });
    expect(rows[0].date).toBe("6 Jul 2022");
    expect(rows[0].time).toBe("22:10");
    expect(rows[3].date).toBeNull();
  });
  it("omits platinum when the game has none", () => {
    const rows = buildTimeline([{ type: "bronze", earnedAt: new Date("2022-07-06T20:10:57Z") }], false, now);
    expect(rows.map((r) => r.label)).toEqual(["First trophy", "Latest trophy", "Gap"]);
  });
  it("describes an earned platinum with the span from first trophy", () => {
    const rows = buildTimeline(
      [
        { type: "platinum", earnedAt: new Date("2022-07-17T23:21:00Z") },
        { type: "bronze", earnedAt: new Date("2022-07-06T20:10:57Z") },
      ],
      true,
      now,
    );
    expect(rows[1].note).toBe("1 week, 4 days, 3 hours");
    expect(rows[1].time).toBe("01:21");
  });
});
