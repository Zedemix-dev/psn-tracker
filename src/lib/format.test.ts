import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateTime,
  formatHoursTotal,
  formatInt,
  formatLastPlayedLine,
  formatPercent,
  formatPlayTime,
  formatRelative,
} from "@/src/lib/format";

describe("format", () => {
  it("formats Paris time, winter and summer", () => {
    expect(formatDateTime(new Date("2026-11-04T23:16:37Z"))).toBe("5 Nov 2026, 00:16");
    expect(formatDateTime(new Date("2026-10-11T22:09:43Z"))).toBe("12 Oct 2026, 00:09");
    expect(formatDate(new Date("2026-09-15T10:00:00Z"))).toBe("15 Sep 2026");
  });
  it("formats numbers", () => {
    expect(formatInt(11622)).toBe("11,622");
    expect(formatPercent(93.7419)).toBe("93.74%");
    expect(formatPercent(50)).toBe("50.00%");
    expect(formatHoursTotal(19416 * 3600 + 1800)).toBe("19,416 h");
  });
  it("formats play time", () => {
    expect(formatPlayTime(33 * 3600 + 27 * 60 + 25)).toBe("33h 27m");
    expect(formatPlayTime(11 * 3600)).toBe("11h 00m");
    expect(formatPlayTime(187)).toBe("3m");
    expect(formatPlayTime(1234 * 3600 + 5 * 60 + 59)).toBe("1,234h 05m");
  });
  it("builds the third game line", () => {
    expect(formatLastPlayedLine(new Date("2026-11-05T10:00:00Z"), 120420)).toBe("Last played 5 Nov 2026 | 33h 27m played");
    expect(formatLastPlayedLine(new Date("2026-11-05T10:00:00Z"), null)).toBe("Last played 5 Nov 2026");
    expect(formatLastPlayedLine(null, null)).toBe("");
  });
  it("formats relative time like psnprofiles", () => {
    const now = new Date("2026-11-07T12:00:00Z");
    expect(formatRelative(new Date("2026-11-07T11:59:40Z"), now)).toBe("just now");
    expect(formatRelative(new Date("2026-11-07T11:59:00Z"), now)).toBe("1 minute ago");
    expect(formatRelative(new Date("2026-11-07T11:00:00Z"), now)).toBe("1 hour ago");
    expect(formatRelative(new Date("2026-11-06T12:00:00Z"), now)).toBe("1 day ago");
    expect(formatRelative(new Date("2026-11-04T12:00:00Z"), now)).toBe("3 days ago");
    expect(formatRelative(new Date("2026-10-29T12:00:00Z"), now)).toBe("1 week ago");
    expect(formatRelative(new Date("2026-06-14T12:00:00Z"), now)).toBe("5 months ago");
    expect(formatRelative(new Date("2022-03-04T12:00:00Z"), now)).toBe("5 years ago");
    expect(formatRelative(new Date("2022-08-24T12:00:00Z"), now)).toBe("4 years ago");
  });
});
