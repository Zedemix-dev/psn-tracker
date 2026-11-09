import { describe, expect, it } from "vitest";
import { profileCounterValues, statTileValues } from "./stat-tile-values";

describe("statTileValues", () => {
  it("gives the six tiles, in order, with their formatted values", () => {
    expect(
      statTileValues({
        gamesCompleted: 224,
        totalGames: 1265,
        completionRate: 93.81,
        averageRarity: 26.5,
        unearned: 1768,
        trophiesPerDay: 3.1,
        hoursSeconds: 67_690_800,
      }),
    ).toEqual([
      { label: "Games completed", value: "224", suffix: "/ 1,265" },
      { label: "Completion rate", value: "93.81%" },
      { label: "Average rarity", value: "26.50%" },
      { label: "Unearned trophies", value: "1,768" },
      { label: "Trophies per day", value: "3.10" },
      { label: "Hours played", value: "18,803 h" },
    ]);
  });
});

describe("profileCounterValues", () => {
  it("gives the total, then one counter per trophy type", () => {
    expect(profileCounterValues({ platinum: 230, gold: 990, silver: 2434, bronze: 7976 })).toEqual([
      { type: null, label: "Trophies", value: "11,630" },
      { type: "platinum", label: "Platinum", value: "230" },
      { type: "gold", label: "Gold", value: "990" },
      { type: "silver", label: "Silver", value: "2,434" },
      { type: "bronze", label: "Bronze", value: "7,976" },
    ]);
  });
});
