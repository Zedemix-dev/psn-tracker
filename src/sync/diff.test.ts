import { describe, expect, it } from "vitest";
import { titleNeedsReload, type StoredTitleState } from "@/src/sync/diff";
import { makeRemoteTitle } from "@/tests/fixtures/titles";

const date = new Date("2025-03-01T10:00:00Z");

function stored(overrides: Partial<StoredTitleState> = {}): StoredTitleState {
  return {
    psnLastUpdatedAt: date,
    syncedAt: date,
    earnedPlatinum: 0,
    earnedGold: 0,
    earnedSilver: 0,
    earnedBronze: 0,
    definedPlatinum: 0,
    definedGold: 0,
    definedSilver: 0,
    definedBronze: 3,
    trophySetVersion: "1.00",
    hasTrophyGroups: false,
    ...overrides,
  };
}
const remote = (o = {}) => makeRemoteTitle({ lastUpdatedAt: new Date(date), ...o });

describe("titleNeedsReload", () => {
  it("is true for a title never seen", () => {
    expect(titleNeedsReload(null, remote())).toBe(true);
  });

  it("is false when identical", () => {
    expect(titleNeedsReload(stored(), remote())).toBe(false);
  });

  it("is false when both dates are null", () => {
    expect(titleNeedsReload(stored({ psnLastUpdatedAt: null }), remote({ lastUpdatedAt: null }))).toBe(false);
  });

  it("is true when the row was never fully synced", () => {
    expect(titleNeedsReload(stored({ syncedAt: null }), remote())).toBe(true);
  });

  it("is true when only the last update date changes", () => {
    expect(titleNeedsReload(stored(), remote({ lastUpdatedAt: new Date("2025-03-02T00:00:00Z") }))).toBe(true);
    expect(titleNeedsReload(stored({ psnLastUpdatedAt: null }), remote())).toBe(true);
  });

  it("is true when only trophySetVersion changes (new DLC, nothing earned)", () => {
    expect(titleNeedsReload(stored(), remote({ trophySetVersion: "1.01" }))).toBe(true);
  });

  it("is true when only defined.bronze changes", () => {
    expect(
      titleNeedsReload(stored(), remote({ defined: { platinum: 0, gold: 0, silver: 0, bronze: 4 } })),
    ).toBe(true);
  });

  it("is true when an earned count changes", () => {
    expect(
      titleNeedsReload(stored(), remote({ earned: { platinum: 0, gold: 1, silver: 0, bronze: 0 } })),
    ).toBe(true);
  });

  it("is true when hasTrophyGroups changes", () => {
    expect(titleNeedsReload(stored(), remote({ hasTrophyGroups: true }))).toBe(true);
  });
});
