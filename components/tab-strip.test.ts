import { describe, expect, it } from "vitest";
import { edgeFades, scrollToShow } from "./tab-strip";

const v = (scrollLeft: number, clientWidth = 293) => ({ scrollLeft, clientWidth, scrollWidth: 477 });

describe("tab strip", () => {
  it("fades the right edge at the start, the left at the end, both between", () => {
    expect(edgeFades(v(0))).toEqual({ fl: false, fr: true });
    expect(edgeFades(v(184))).toEqual({ fl: true, fr: false });
    expect(edgeFades(v(90))).toEqual({ fl: true, fr: true });
  });
  it("never fades when the tabs fit", () => expect(edgeFades(v(0, 600))).toEqual({ fl: false, fr: false }));
  it("centres a hidden tab, clamped to the end", () => {
    expect(scrollToShow(v(0), { left: 414, width: 63 })).toBe(184); // Stats
    expect(scrollToShow(v(0), { left: 171, width: 102 })).toBe(76); // Trophy Log, under the right fade
  });
  it("leaves a fully visible tab alone", () => {
    expect(scrollToShow(v(0), { left: 0, width: 74 })).toBeNull();
    expect(scrollToShow(v(0), { left: 80, width: 85 })).toBeNull();
    expect(scrollToShow(v(184), { left: 279, width: 129 })).toBeNull();
    expect(scrollToShow(v(0, 600), { left: 414, width: 63 })).toBeNull();
  });
});
