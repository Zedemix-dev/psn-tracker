import { describe, expect, it } from "vitest";
import { unobtainableLabel, unobtainableSituation } from "@/src/unobtainable/labels";

describe("unobtainableLabel", () => {
  it.each([
    [7, 41, "7 unobtainable trophies"],
    [1, 41, "1 unobtainable trophy"],
    [37, 37, "All 37 trophies are unobtainable"],
    [1, 1, "1 unobtainable trophy"],
  ])("label %i/%i", (c, t, s) => expect(unobtainableLabel(c, t)).toBe(s));
});

describe("unobtainableSituation", () => {
  it.each([
    [7, 4, ", 4 you don't have"],
    [10, 0, ", you have them all"],
    [1, 0, ", you have it"],
    [1, 1, ", 1 you don't have"],
  ])("situation %i/%i", (c, m, s) => expect(unobtainableSituation(c, m)).toBe(s));
});
