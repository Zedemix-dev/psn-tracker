import { describe, expect, it } from "vitest";
import { compareEarnedOrder, type EarnedOrderKey } from "@/src/lib/earned-order";

const at = (s: number, ms = 0) => Date.UTC(2026, 10, 4, 23, 16, s, ms);
const key = (o: Partial<EarnedOrderKey> & { earnedAtMs: number }): EarnedOrderKey => ({
  type: "bronze",
  trophyId: 1,
  ...o,
});

describe("compareEarnedOrder", () => {
  it("orders by the second first", () => {
    const plat = key({ earnedAtMs: at(36, 900), type: "platinum", trophyId: 0 });
    const bronze = key({ earnedAtMs: at(37, 0) });
    expect(compareEarnedOrder(plat, bronze)).toBeLessThan(0);
    expect(compareEarnedOrder(bronze, plat)).toBeGreaterThan(0);
  });

  it("puts the platinum after the other trophies of its second", () => {
    const plat = key({ earnedAtMs: at(37, 100), type: "platinum", trophyId: 0 });
    const gold = key({ earnedAtMs: at(37, 900), type: "gold", trophyId: 5 });
    expect(compareEarnedOrder(gold, plat)).toBeLessThan(0);
    expect(compareEarnedOrder(plat, gold)).toBeGreaterThan(0);
  });

  it("breaks a tie by trophyId, then titleId", () => {
    const three = key({ earnedAtMs: at(37), trophyId: 3, titleId: "NPWR2" });
    const four = key({ earnedAtMs: at(37), trophyId: 4, titleId: "NPWR1" });
    expect(compareEarnedOrder(three, four)).toBeLessThan(0);
    const a = key({ earnedAtMs: at(37), trophyId: 3, titleId: "NPWR10" });
    const b = key({ earnedAtMs: at(37), trophyId: 3, titleId: "NPWR2" });
    expect(compareEarnedOrder(a, b)).toBeLessThan(0); // code-unit order, not numeric
    expect(compareEarnedOrder(b, a)).toBeGreaterThan(0);
    expect(compareEarnedOrder(a, { ...a })).toBe(0);
  });

  it("treats a missing titleId as empty", () => {
    const none = key({ earnedAtMs: at(37) });
    const some = key({ earnedAtMs: at(37), titleId: "NPWR1" });
    expect(compareEarnedOrder(none, some)).toBeLessThan(0);
    expect(compareEarnedOrder(none, key({ earnedAtMs: at(37), titleId: "" }))).toBe(0);
  });
});
