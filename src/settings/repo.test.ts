import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/src/db/client";
import { DEFAULT_UNOBTAINABLE_LIST_URL, settings } from "@/src/db/schema";
import { createTestDb } from "@/tests/helpers/db";
import {
  getSettings,
  loadPsnTokens,
  clearUnobtainableRequest,
  requestSync,
  setAdvisorDlc,
  setAdvisorHideUnobtainable,
  saveUnobtainableUrl,
  savePsnTokens,
  setBanner,
  setHideZero,
  setPsnAuthStatus,
  peekSyncRequest,
  clearSyncRequest,
  failSyncRequest,
} from "@/src/settings/repo";

const key = randomBytes(32);
const tokens = {
  accessToken: "access-secret",
  accessExpiresAt: new Date("2026-11-07T11:00:00Z"),
  refreshToken: "refresh-secret",
  refreshExpiresAt: new Date("2027-01-07T10:00:00Z"),
};

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe("settings repo", () => {
  it("returns defaults without encrypted columns", async () => {
    const s = await getSettings(db);
    expect(s).toEqual({
      hideZero: false,
      advisorHideUnobtainable: false,
      advisorDlc: "all",
      bannerPath: null,
      bannerPosY: 50,
      npssoSetAt: null,
      psnAuthStatus: "missing",
      syncRequestedAt: null,
      unobtainableListUrl: DEFAULT_UNOBTAINABLE_LIST_URL,
      unobtainableRequestedAt: null,
    });
  });

  it("starts with every Trophy Advisor setting off", async () => {
    expect(await getSettings(db)).toMatchObject({ advisorHideUnobtainable: false, advisorDlc: "all" });
  });

  it("saves the Trophy Advisor settings", async () => {
    await setAdvisorHideUnobtainable(db, true);
    await setAdvisorDlc(db, "only");
    expect(await getSettings(db)).toMatchObject({ advisorHideUnobtainable: true, advisorDlc: "only" });
  });

  it("saveUnobtainableUrl writes the address and the request", async () => {
    const now = new Date("2026-11-09T10:00:00Z");
    await saveUnobtainableUrl(db, "https://x.example/list.json", now);
    const s = await getSettings(db);
    expect(s.unobtainableListUrl).toBe("https://x.example/list.json");
    expect(s.unobtainableRequestedAt).toEqual(now);
  });

  it("clearUnobtainableRequest only clears the value it saw", async () => {
    const t1 = new Date("2026-11-09T10:00:00Z");
    const t2 = new Date("2026-11-09T10:05:00Z");
    await saveUnobtainableUrl(db, "https://x.example/l", t2);
    await clearUnobtainableRequest(db, t1);
    expect((await getSettings(db)).unobtainableRequestedAt).toEqual(t2);
    await clearUnobtainableRequest(db, t2);
    expect((await getSettings(db)).unobtainableRequestedAt).toBeNull();
  });

  it("updates hideZero and banner", async () => {
    await setHideZero(db, true);
    await setBanner(db, "banner.jpg", 30);
    const s = await getSettings(db);
    expect(s.hideZero).toBe(true);
    expect(s.bannerPath).toBe("banner.jpg");
    expect(s.bannerPosY).toBe(30);
  });

  it("stores tokens encrypted with the npsso and marks auth valid", async () => {
    const now = new Date("2026-11-07T10:00:00Z");
    expect(await loadPsnTokens(db, key)).toBeNull();
    await savePsnTokens(db, key, tokens, "my-npsso", now);
    const s = await getSettings(db);
    expect(s.npssoSetAt).toEqual(now);
    expect(s.psnAuthStatus).toBe("valid");
    const [row] = await db.select().from(settings);
    expect(row.npssoEnc).not.toContain("my-npsso");
    expect(row.refreshTokenEnc).not.toContain("refresh-secret");
    expect(row.accessTokenEnc).not.toContain("access-secret");
    expect(await loadPsnTokens(db, key)).toEqual({ ...tokens, npssoSetAt: now });
  });

  it("keeps the npsso when saving tokens without one", async () => {
    const now = new Date("2026-11-07T10:00:00Z");
    await savePsnTokens(db, key, tokens, "my-npsso", now);
    await setPsnAuthStatus(db, "expired");
    await savePsnTokens(db, key, { ...tokens, accessToken: "new-access" }, undefined, new Date());
    const s = await getSettings(db);
    expect(s.npssoSetAt).toEqual(now);
    expect(s.psnAuthStatus).toBe("valid");
    expect((await loadPsnTokens(db, key))?.accessToken).toBe("new-access");
  });

  describe("sync request", () => {
    const T = new Date("2026-11-07T10:00:00Z");
    const failures = async () =>
      (await db.select({ n: settings.syncRequestFailures }).from(settings))[0].n;

    it("peeks without consuming", async () => {
      expect(await peekSyncRequest(db)).toBeNull();
      await requestSync(db, T);
      expect(await peekSyncRequest(db)).toEqual(T);
      expect(await peekSyncRequest(db)).toEqual(T);
    });

    it("a new request resets the failure count", async () => {
      await requestSync(db, T);
      await failSyncRequest(db, T);
      await failSyncRequest(db, T);
      expect(await failures()).toBe(2);
      await requestSync(db, new Date("2026-11-07T12:00:00Z"));
      expect(await failures()).toBe(0);
    });

    it("clears only a request that still holds the seen value, and resets the failures", async () => {
      await requestSync(db, T);
      await failSyncRequest(db, T);
      await clearSyncRequest(db, new Date("2026-11-07T11:00:00Z"));
      expect(await peekSyncRequest(db)).toEqual(T);
      expect(await failures()).toBe(1);
      await clearSyncRequest(db, T);
      expect(await peekSyncRequest(db)).toBeNull();
      expect(await failures()).toBe(0);
    });

    it("counts failures, and gives up at the third", async () => {
      await requestSync(db, T);
      expect(await failSyncRequest(db, T)).toBe(1);
      expect(await failSyncRequest(db, T)).toBe(2);
      expect(await peekSyncRequest(db)).toEqual(T);
      expect(await failSyncRequest(db, T)).toBe(3);
      expect(await peekSyncRequest(db)).toBeNull();
      expect(await failures()).toBe(0);
    });

    it("ignores a failure for a request that was replaced meanwhile", async () => {
      await requestSync(db, T);
      const newer = new Date("2026-11-07T11:00:00Z");
      await requestSync(db, newer);
      expect(await failSyncRequest(db, T)).toBe(0);
      expect(await peekSyncRequest(db)).toEqual(newer);
      expect(await failures()).toBe(0);
    });
  });
});
