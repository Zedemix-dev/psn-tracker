import { describe, expect, it } from "vitest";
import { compactTick, monotonePath, niceScale, tipPosition } from "@/src/stats/chart-geometry";

describe("niceScale", () => {
  it.each([
    [380, 4, 100, 400],
    [11636, 5, 2500, 12500],
    [530, 6, 100, 600],
    [37, 4, 10, 40],
  ])("niceScale(%i, %i)", (max, ticks, step, top) => {
    expect(niceScale(max, ticks)).toEqual({ step, max: top });
  });
  it("never divides by zero", () => {
    const s = niceScale(0, 4);
    expect(s.max).toBeGreaterThan(0);
    expect(s.step).toBeGreaterThan(0);
  });
});

describe("monotonePath", () => {
  it("starts on the first point and has one curve per segment", () => {
    const d = monotonePath([[0, 10], [10, 4], [20, 8], [30, 2]]);
    expect(d.startsWith("M0,10")).toBe(true);
    expect(d.match(/C/g)).toHaveLength(3);
    expect(d).not.toContain("NaN");
  });
  it("of one point is a move only, with no NaN", () => {
    expect(monotonePath([[5, 7]])).toBe("M5,7");
  });
  it("of no points is empty", () => {
    expect(monotonePath([])).toBe("");
  });
  it("stays flat on a flat segment", () => {
    const d = monotonePath([[0, 10], [10, 10], [20, 10]]);
    const ys = [...d.matchAll(/C([\d.]+),([\d.]+) ([\d.]+),([\d.]+) ([\d.]+),([\d.]+)/g)].flatMap((m) => [m[2], m[4], m[6]]);
    expect(ys.length).toBe(6);
    expect(ys.every((y) => Number(y) === 10)).toBe(true);
  });
});

describe("compactTick", () => {
  it("writes thousands compactly from 10,000", () => {
    expect(compactTick(7500)).toBe("7,500");
    expect(compactTick(10000)).toBe("10K");
    expect(compactTick(12500)).toBe("12.5K");
  });
});

describe("tipPosition", () => {
  const viewport = { w: 1000, h: 800 };
  const size = { w: 120, h: 50 };
  it("sits above and to the right of the pointer", () => {
    expect(tipPosition({ x: 300, y: 300 }, size, viewport)).toEqual({ left: 314, top: 240 });
  });
  it("flips left at the right edge", () => {
    expect(tipPosition({ x: 950, y: 300 }, size, viewport).left).toBe(950 - 120 - 14);
  });
  it("stays on screen near the left edge with a wide tooltip", () => {
    const pos = tipPosition({ x: 150, y: 300 }, { w: 250, h: 50 }, { w: 375, h: 800 });
    expect(pos.left).toBe(8);
    const low = tipPosition({ x: 150, y: 790 }, { w: 250, h: 50 }, { w: 375, h: 800 });
    expect(low.top).toBeLessThanOrEqual(800 - 50 - 8);
  });
  it("flips below at the top edge", () => {
    expect(tipPosition({ x: 300, y: 20 }, size, viewport).top).toBe(36);
  });
});
