import { describe, expect, it } from "vitest";
import { formatSpan } from "./span";

describe("formatSpan", () => {
  it("keeps a window of 3 units", () => {
    expect(formatSpan(new Date("2022-07-06T20:10:57Z"), new Date("2022-07-17T23:21:00Z"), 3)).toBe(
      "1 week, 4 days, 3 hours",
    );
  });
  it("counts on Paris wall-clock time across a DST change", () => {
    expect(formatSpan(new Date("2022-07-06T20:10:57Z"), new Date("2026-11-07T18:21:58Z"))).toBe(
      "4 years, 4 months, 21 hours, 11 minutes",
    );
  });
  it("drops zero units after windowing", () => {
    expect(formatSpan(new Date("2022-07-01T10:00:00Z"), new Date("2023-07-18T10:00:00Z"), 3)).toBe("1 year, 2 weeks");
  });
  it("reads less than a minute", () => {
    expect(formatSpan(new Date("2022-07-01T10:00:00Z"), new Date("2022-07-01T10:00:30Z"))).toBe("less than a minute");
  });
});
