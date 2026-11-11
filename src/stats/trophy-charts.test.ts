import { describe, expect, it } from "vitest";
import type { TrophyType } from "@/src/db/schema";
import type { EarnedTrophy } from "./trophies";
import { buildTrophyCharts } from "./trophy-charts";

const NOW = new Date("2026-11-11T12:00:00Z"); // a Wednesday

type Charts = ReturnType<typeof buildTrophyCharts>;

let seq = 0;
function t(iso: string, type: TrophyType = "bronze", earnedRate: number | null = null): EarnedTrophy {
  seq += 1;
  return { titleId: "T", trophyId: seq, name: `t${seq}`, detail: "", iconUrl: null, type, earnedAt: new Date(iso), earnedRate, gameName: "G" };
}
const days = (c: Charts) => c.calendar.weeks.flat().filter((d) => d !== null);
const dayOf = (c: Charts, date: string) => days(c).find((d) => d!.date === date)!;

describe("buildTrophyCharts", () => {
  it("counts a trophy on its Paris day, hour and weekday in summer", () => {
    const c = buildTrophyCharts([t("2026-08-31T22:30:00Z")], NOW);
    expect(dayOf(c, "2026-09-01").trophies).toBe(1);
    expect(dayOf(c, "2026-08-31").trophies).toBe(0);
    expect(c.hours[0]).toBe(1);
    expect(c.weekdays[1]).toBe(1);
    expect(c.months[0].title).toBe("Sep 2026");
  });

  it("counts a trophy on its Paris day in winter", () => {
    const c = buildTrophyCharts([t("2026-01-01T23:30:00Z")], NOW);
    expect(dayOf(c, "2026-01-02").trophies).toBe(1);
    expect(c.hours[0]).toBe(1);
  });

  it("builds 53 weeks ending with the current one", () => {
    const w = buildTrophyCharts([], NOW).calendar.weeks;
    expect(w).toHaveLength(53);
    expect(w.every((col) => col.length === 7)).toBe(true);
    expect(w[52][2]!.date).toBe("2026-11-11");
    expect(w[52][2]!.label).toBe("Wed 11 Nov 2026");
    expect(w[52][3]).toBeNull();
    expect(w[0][0]!.date).toBe("2025-11-10");
  });

  it("uses the Paris date for today", () => {
    const c = buildTrophyCharts([], new Date("2026-11-10T23:30:00Z"));
    expect(c.calendar.weeks[52][2]!.date).toBe("2026-11-11");
    expect(c.calendar.weeks[52][3]).toBeNull();
  });

  it("labels each month above its first Monday, except in the last two columns", () => {
    const m = buildTrophyCharts([], NOW).calendar.months;
    expect(m[0]).toEqual({ column: 3, label: "Dec" });
    expect(m).toContainEqual({ column: 47, label: "Oct" });
    expect(m.some((x) => x.label === "Nov" && x.column > 3)).toBe(false);
  });

  it("does not shift the grid across a clock change", () => {
    const dates = days(buildTrophyCharts([], NOW)).map((d) => d!.date);
    for (let i = 1; i < dates.length; i++) {
      expect((Date.parse(dates[i]) - Date.parse(dates[i - 1])) / 86_400_000).toBe(1);
    }
    expect(dates.filter((d) => d === "2026-03-29")).toHaveLength(1);
    expect(dates.filter((d) => d === "2026-10-25")).toHaveLength(1);
  });

  it("keeps a streak across a clock change", () => {
    const c = buildTrophyCharts([t("2026-03-28T12:00:00Z"), t("2026-03-29T12:00:00Z"), t("2026-03-30T12:00:00Z")], NOW);
    expect(c.calendar.summary.streak).toEqual({ days: 3, trophies: 3, from: "28 Mar 2026", to: "30 Mar 2026" });
  });

  it("sums the summary over the visible days only", () => {
    const c = buildTrophyCharts([t("2025-11-09T12:00:00Z", "platinum"), t("2025-11-10T12:00:00Z", "platinum"), t("2026-01-05T12:00:00Z")], NOW);
    expect(c.total).toBe(3);
    expect(c.calendar.summary.trophies).toBe(2);
    expect(c.calendar.summary.platinums).toBe(1);
  });

  it("picks the most recent best day on a tie", () => {
    const c = buildTrophyCharts(
      [t("2026-05-01T12:00:00Z"), t("2026-05-01T13:00:00Z"), t("2026-06-01T12:00:00Z"), t("2026-06-01T13:00:00Z"), t("2026-07-01T12:00:00Z")],
      NOW,
    );
    expect(c.calendar.summary.bestDay).toEqual({ trophies: 2, label: "Mon 1 Jun 2026" });
  });

  it("finds the longest streak, its trophies and its dates", () => {
    const list = [1, 2, 3, 10, 11, 12, 13, 14].map((d) => t(`2026-08-${String(d).padStart(2, "0")}T12:00:00Z`));
    list.push(t("2026-08-12T13:00:00Z"));
    expect(buildTrophyCharts(list, NOW).calendar.summary.streak).toEqual({ days: 5, trophies: 6, from: "10 Aug 2026", to: "14 Aug 2026" });
  });

  it("picks the most recent streak on a tie", () => {
    const list = ["2026-04-01", "2026-04-02", "2026-06-01", "2026-06-02"].map((d) => t(`${d}T12:00:00Z`));
    expect(buildTrophyCharts(list, NOW).calendar.summary.streak).toMatchObject({ days: 2, from: "1 Jun 2026", to: "2 Jun 2026" });
  });

  it("has no best day and no streak when the window is empty", () => {
    const c = buildTrophyCharts([t("2020-05-05T12:00:00Z")], NOW);
    expect(c.calendar.summary).toEqual({ trophies: 0, platinums: 0, bestDay: null, streak: null });
  });

  it("includes empty months and accumulates each type", () => {
    const c = buildTrophyCharts(
      [t("2026-01-10T12:00:00Z", "gold"), t("2026-01-11T12:00:00Z"), t("2026-03-10T12:00:00Z", "silver")],
      new Date("2026-03-20T12:00:00Z"),
    );
    expect(c.months.map((m) => m.label)).toEqual(["Jan 26", "Feb 26", "Mar 26"]);
    expect(c.months[1]).toEqual({ label: "Feb 26", title: "Feb 2026", trophies: 0, platinum: 0, gold: 1, silver: 0, bronze: 1 });
    expect(c.months[2]).toMatchObject({ trophies: 1, gold: 1, silver: 1, bronze: 1 });
  });

  it("runs months from the first trophy to the current month", () => {
    const c = buildTrophyCharts([t("2016-11-05T12:00:00Z")], NOW);
    expect(c.months).toHaveLength(10 * 12 + 1);
    expect(c.months[0]).toMatchObject({ label: "Nov 16", title: "Nov 2016" });
    expect(c.months.at(-1)).toMatchObject({ title: "Nov 2026", bronze: 1, trophies: 0 });
  });

  it("leaves unrated trophies out of the rarity", () => {
    const c = buildTrophyCharts(
      [t("2026-05-01T12:00:00Z", "bronze", 4), t("2026-05-02T12:00:00Z", "bronze", 60), t("2026-05-03T12:00:00Z", "bronze", null)],
      NOW,
    );
    expect(c.rarity.tiers).toEqual({ "Ultra rare": 1, "Very rare": 0, Rare: 0, Uncommon: 0, Common: 1 });
    expect(c.rarity.average).toBe(32);
  });

  it("rounds the average rarity to 2 decimals", () => {
    const c = buildTrophyCharts([t("2026-05-01T12:00:00Z", "bronze", 1), t("2026-05-02T12:00:00Z", "bronze", 1), t("2026-05-03T12:00:00Z", "bronze", 2)], NOW);
    expect(c.rarity.average).toBe(1.33);
  });

  it("adds points with the PSN values", () => {
    const types: TrophyType[] = ["platinum", "gold", "silver", "bronze"];
    const c = buildTrophyCharts(types.map((ty) => t("2026-05-01T12:00:00Z", ty)), NOW);
    expect(c.points).toEqual({ platinum: 300, gold: 90, silver: 30, bronze: 15 });
    expect(c.totalPoints).toBe(435);
    expect(c.counts).toEqual({ platinum: 1, gold: 1, silver: 1, bronze: 1 });
  });

  it("is empty without trophies", () => {
    const c = buildTrophyCharts([], NOW);
    expect(c.total).toBe(0);
    expect(c.months).toEqual([]);
    expect(c.hours).toEqual(new Array(24).fill(0));
    expect(c.weekdays).toEqual(new Array(7).fill(0));
    expect(c.rarity.average).toBe(0);
    expect(c.totalPoints).toBe(0);
  });
});
