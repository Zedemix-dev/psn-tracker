import { describe, expect, it } from "vitest";
import type { TrophyRowData } from "@/src/games/detail";
import { filterAndSort, parseTrophyView, trophyViewParams } from "@/src/games/trophy-view";

const row = (id: number, o: Partial<TrophyRowData> = {}): TrophyRowData => ({
  id,
  groupId: "default",
  type: "bronze",
  name: `T${id}`,
  detail: "",
  iconSrc: "/i.png",
  earned: false,
  earnedDate: null,
  earnedTime: null,
  earnedAtMs: null,
  rate: 10,
  rateLabel: "10.00%",
  tier: "Rare",
  counter: null,
  unobtainable: false,
  ...o,
});

const rows = [
  row(0, { earned: true, earnedAtMs: 300_000, rate: 50 }),
  row(1, { rate: null }),
  row(2, { earned: true, earnedAtMs: 100_000, rate: 2 }),
  row(3, { rate: 2 }),
  row(4),
];
const ids = (r: TrophyRowData[]) => r.map((t) => t.id);

describe("filterAndSort", () => {
  it("sorts in PSN order", () => {
    expect(ids(filterAndSort([rows[3], rows[0], rows[2]], "all", "psn"))).toEqual([0, 2, 3]);
  });
  it("sorts by date: earned ascending, then unearned by id", () => {
    expect(ids(filterAndSort(rows, "all", "date"))).toEqual([2, 0, 1, 3, 4]);
  });
  it("sorts by date with the platinum after the last trophy of its second", () => {
    const T = 1_700_000_000_000;
    const list = [
      row(0, { type: "platinum", earned: true, earnedAtMs: T + 100 }),
      row(1),
      row(3, { earned: true, earnedAtMs: T - 60_000 }),
      row(5, { type: "gold", earned: true, earnedAtMs: T + 900 }),
    ];
    expect(ids(filterAndSort(list, "all", "date"))).toEqual([3, 5, 0, 1]);
  });
  it("sorts by rarity with null last and ties by id", () => {
    expect(ids(filterAndSort(rows, "all", "rarity"))).toEqual([2, 3, 4, 0, 1]);
  });
  it("filters earned and unearned", () => {
    expect(ids(filterAndSort(rows, "earned", "psn"))).toEqual([0, 2]);
    expect(ids(filterAndSort(rows, "unearned", "psn"))).toEqual([1, 3, 4]);
  });
  it("does not mutate its input", () => {
    const copy = [...rows];
    filterAndSort(rows, "all", "rarity");
    expect(rows).toEqual(copy);
  });
});

describe("parseTrophyView / trophyViewParams", () => {
  it("falls back to defaults on unknown values", () => {
    expect(parseTrophyView(new URLSearchParams("show=bogus&sort=rarity"))).toEqual({ show: "all", sort: "rarity" });
  });
  it("omits default values", () => {
    expect(trophyViewParams({ show: "all", sort: "psn" }).toString()).toBe("");
    expect(trophyViewParams({ show: "earned", sort: "date" }).toString()).toBe("show=earned&sort=date");
  });
});
