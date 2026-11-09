import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EXPORT_TTL_MS, forgetExport, recallExport, rememberExport } from "@/src/plat-wall/export-memo";

beforeEach(() => {
  vi.useFakeTimers();
  forgetExport();
});
afterEach(() => {
  forgetExport();
  vi.useRealTimers();
});

describe("export memo", () => {
  it("returns the image for its key only", () => {
    const png = Buffer.from("a");
    rememberExport("year=2026", png);
    expect(recallExport("year=2026")).toBe(png);
    expect(recallExport("year=2025")).toBeNull();
  });

  it("keeps one image: the next one replaces it", () => {
    rememberExport("a", Buffer.from("a"));
    rememberExport("b", Buffer.from("b"));
    expect(recallExport("a")).toBeNull();
    expect(recallExport("b")?.toString()).toBe("b");
  });

  it("forgets it after 10 minutes", () => {
    rememberExport("a", Buffer.from("a"));
    vi.advanceTimersByTime(EXPORT_TTL_MS - 1);
    expect(recallExport("a")).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(recallExport("a")).toBeNull();
  });
});
