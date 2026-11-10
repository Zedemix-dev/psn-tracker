import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateAndTime,
  formatDateTime,
  formatDateTimeSeconds,
  formatDuration,
  formatTime,
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
  it("formats durations, in seconds under a minute", () => {
    expect(formatDuration(42.4)).toBe("42s");
    expect(formatDuration(0.2)).toBe("0s");
    expect(formatDuration(-1.5)).toBe("0s");
    expect(formatDuration(59.4)).toBe("59s");
    expect(formatDuration(59.6)).toBe("1m");
    expect(formatDuration(187)).toBe("3m");
    expect(formatDuration(33 * 3600 + 27 * 60 + 25)).toBe("33h 27m");
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
  it("picks the relative unit after rounding", () => {
    const now = new Date("2026-11-07T12:00:00Z");
    const ago = (seconds: number) => formatRelative(new Date(now.getTime() - seconds * 1000), now);
    expect(ago(59.6 * 60)).toBe("1 hour ago");
    expect(ago(23.6 * 3600)).toBe("1 day ago");
    expect(ago(6.6 * 86_400)).toBe("1 week ago");
    expect(ago(360 * 86_400)).toBe("1 year ago");
    expect(ago(59.4 * 60)).toBe("59 minutes ago");
    expect(ago(6.4 * 86_400)).toBe("6 days ago");
    expect(ago(29 * 86_400)).toBe("4 weeks ago");
    expect(ago(340 * 86_400)).toBe("11 months ago");
  });
});

describe("formatTime", () => {
  it("formats the Paris wall-clock time", () => {
    expect(formatTime(new Date("2022-07-17T23:21:00Z"))).toBe("01:21:00");
    expect(formatTime(new Date("2022-07-17T23:21:07Z"))).toBe("01:21:07");
  });
});

describe("formatDateTimeSeconds", () => {
  it("adds the seconds and leaves formatDateTime unchanged", () => {
    expect(formatDateTimeSeconds(new Date("2026-11-04T23:16:37Z"))).toBe("5 Nov 2026, 00:16:37");
    expect(formatDateTime(new Date("2026-11-04T23:16:37Z"))).toBe("5 Nov 2026, 00:16");
  });
});

describe("formatDateAndTime", () => {
  it("matches formatDate and formatTime in one call", () => {
    for (const iso of ["2022-07-17T23:21:00Z", "2022-07-17T23:21:07Z", "2026-11-04T23:16:37Z"]) {
      const d = new Date(iso);
      expect(formatDateAndTime(d)).toEqual({ date: formatDate(d), time: formatTime(d) });
    }
    expect(formatDateAndTime(new Date("2022-07-17T23:21:07Z"))).toEqual({ date: "18 Jul 2022", time: "01:21:07" });
  });
});
