import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/src/db/client";
import { settings } from "@/src/db/schema";
import { createTestDb } from "@/tests/helpers/db";
import {
  getSettings,
  loadPsnTokens,
  requestSync,
  savePsnTokens,
  setBanner,
  setHideZero,
  setPsnAuthStatus,
  takeSyncRequest,
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
      bannerPath: null,
      bannerPosY: 50,
      npssoSetAt: null,
      psnAuthStatus: "missing",
      syncRequestedAt: null,
    });
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

  it("takes a sync request once", async () => {
    expect(await takeSyncRequest(db)).toBe(false);
    await requestSync(db, new Date());
    expect((await getSettings(db)).syncRequestedAt).not.toBeNull();
    expect(await takeSyncRequest(db)).toBe(true);
    expect(await takeSyncRequest(db)).toBe(false);
  });
});
