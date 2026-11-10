// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveLogSnapshot, takeLogSnapshot } from "@/components/trophy-log/log-snapshot";

beforeEach(() => history.replaceState(null, ""));
afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe("log snapshot", () => {
  it("restores on the history entry it was taken on", () => {
    saveLogSnapshot({ key: "k", loaded: 120, scrollY: 3400 });
    expect(takeLogSnapshot("k")).toEqual({ key: "k", loaded: 120, scrollY: 3400 });
    expect(takeLogSnapshot("k")).not.toBeNull(); // still there after a second mount
  });

  it("round-trips the anchor row and accepts an old snapshot without it", () => {
    saveLogSnapshot({ key: "k", loaded: 120, scrollY: 3400, anchorKey: "G:5", anchorOffset: -12.5 });
    expect(takeLogSnapshot("k")).toEqual({ key: "k", loaded: 120, scrollY: 3400, anchorKey: "G:5", anchorOffset: -12.5 });
    saveLogSnapshot({ key: "k", loaded: 120, scrollY: 3400 });
    expect(takeLogSnapshot("k")).toEqual({ key: "k", loaded: 120, scrollY: 3400 });
    saveLogSnapshot({ key: "k", loaded: 120, scrollY: 3400, anchorKey: "G:5" });
    expect(takeLogSnapshot("k")).toEqual({ key: "k", loaded: 120, scrollY: 3400 });
  });

  it("stores no rows", () => {
    saveLogSnapshot({ key: "k", loaded: 120, scrollY: 3400 });
    expect(Object.keys(JSON.parse(sessionStorage.getItem("trophy-log-list")!)).sort()).toEqual([
      "id",
      "key",
      "loaded",
      "scrollY",
    ]);
  });

  it("keeps Next's own history state when tagging the entry", () => {
    history.replaceState({ __NA: true }, "");
    saveLogSnapshot({ key: "k", loaded: 1, scrollY: 1 });
    expect(history.state.__NA).toBe(true);
    expect(history.state.trophyLogSnapshot).toBeTruthy();
  });

  it("ignores another key or an untagged entry", () => {
    saveLogSnapshot({ key: "k", loaded: 120, scrollY: 3400 });
    expect(takeLogSnapshot("other")).toBeNull();
    history.pushState(null, "");
    expect(takeLogSnapshot("k")).toBeNull();
  });

  it("does not throw when storage fails", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => saveLogSnapshot({ key: "k", loaded: 1, scrollY: 1 })).not.toThrow();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(takeLogSnapshot("k")).toBeNull();
  });
});
