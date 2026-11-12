import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/src/db/client";
import { images, playedGames, syncRuns, titles, trophies, trophyGroups } from "@/src/db/schema";
import type { AppConfig } from "@/src/lib/config";
import { savePsnTokens } from "@/src/settings/repo";
import { runDailyRefresh } from "@/src/sync/daily";
import { runSync } from "@/src/sync/run";
import { createFakePsn } from "@/tests/fakes/psn";
import { makeGroup, makeRemoteTitle, makeTrophies } from "@/tests/fixtures/titles";
import { createTestDb } from "@/tests/helpers/db";

const now = new Date("2026-01-01T12:00:00Z");
const later = new Date("2026-01-02T12:00:00Z");
const ID = "NPWR00001_00";
const deps = {
  sleep: vi.fn(async (_ms: number) => {}),
  fetchImpl: vi.fn(async () => new Response(new Uint8Array([1]), { status: 200 })) as unknown as typeof fetch,
};

let db: Db;
let mediaDir: string;
let cfg: AppConfig;

function gwWith(rate: number, groups = [makeGroup("default")], extraDefs = 0) {
  const base = makeTrophies(2);
  const dlc = makeTrophies(extraDefs, { groupId: "001", start: 2 });
  const userTrophies = [...base.userTrophies, ...dlc.userTrophies];
  userTrophies.forEach((u) => (u.earnedRate = rate));
  return createFakePsn({
    titles: [makeRemoteTitle({ defined: { platinum: 0, gold: 0, silver: 0, bronze: 2 + extraDefs } })],
    titleData: { [ID]: { groups, defs: [...base.defs, ...dlc.defs], userTrophies } },
  });
}

beforeEach(async () => {
  db = await createTestDb();
  mediaDir = await fs.mkdtemp(path.join(os.tmpdir(), "daily-"));
  cfg = {
    databaseUrl: "pglite:memory",
    adminUsername: "a",
    adminPasswordHash: "h",
    appSecret: Buffer.alloc(32, 7),
    psnLanguage: "en-GB",
    mediaDir,
  };
  await savePsnTokens(db, cfg.appSecret, {
    accessToken: "a",
    accessExpiresAt: new Date("2099-01-01T00:00:00Z"),
    refreshToken: "r",
    refreshExpiresAt: new Date("2099-06-01T00:00:00Z"),
  });
  await runSync(db, gwWith(1.3), cfg, "manual", now, deps);
});
afterEach(async () => {
  await fs.rm(mediaDir, { recursive: true, force: true });
});

describe("runDailyRefresh", () => {
  it("updates earnedRate from 1.30 to 1.28 without reloading the title", async () => {
    const gw = gwWith(1.28);
    const res = await runDailyRefresh(db, gw, cfg, later, deps);

    expect(res.status).toBe("success");
    const rows = await db.select().from(trophies).where(eq(trophies.titleId, ID));
    expect(rows.map((r) => r.earnedRate)).toEqual(["1.28", "1.28"]);
    expect(gw.calls.filter((c) => c.startsWith("getTrophyDefs"))).toHaveLength(0);
    const [t] = await db.select().from(titles).where(eq(titles.npCommunicationId, ID));
    expect(t.groupsCheckedAt).toEqual(later);
    const runs = await db.select().from(syncRuns).orderBy(syncRuns.id);
    expect(runs[1]).toMatchObject({ kind: "daily", status: "success", titlesDone: 1 });
  });

  it("reloads a title whose group set changed", async () => {
    const gw = gwWith(1.3, [makeGroup("default"), makeGroup("001")], 2);
    await runDailyRefresh(db, gw, cfg, later, deps);

    expect(gw.calls.filter((c) => c.startsWith("getTrophyDefs"))).toHaveLength(1);
    expect(await db.select().from(trophyGroups).where(eq(trophyGroups.titleId, ID))).toHaveLength(2);
    expect(await db.select().from(trophies).where(eq(trophies.titleId, ID))).toHaveLength(4);
  });

  it("refreshes tiered trophy progress daily", async () => {
    const gwAt = (progress: number) => {
      const { defs, userTrophies } = makeTrophies(2);
      defs[0].progressTarget = 4;
      userTrophies[0].progress = progress;
      return createFakePsn({
        titles: [makeRemoteTitle({ defined: { platinum: 0, gold: 0, silver: 0, bronze: 2 } })],
        titleData: { [ID]: { groups: [makeGroup("default")], defs, userTrophies } },
      });
    };
    // The title is already synced (beforeEach); seed a stored progress of 1.
    await db.update(trophies).set({ progressTarget: 4, progress: 1 }).where(eq(trophies.trophyId, 0));
    const [before] = await db.select().from(trophies).where(eq(trophies.trophyId, 0));
    expect(before.progress).toBe(1);

    await runDailyRefresh(db, gwAt(2), cfg, later, deps);

    const [after] = await db.select().from(trophies).where(eq(trophies.trophyId, 0));
    expect(after).toMatchObject({ progress: 2, progressTarget: 4 });
  });

  it("skips hidden titles", async () => {
    await db.update(titles).set({ hidden: true });
    const gw = gwWith(1.28);
    await runDailyRefresh(db, gw, cfg, later, deps);
    expect(gw.calls.filter((c) => c.startsWith("getUserTrophies"))).toHaveLength(0);
  });

  it("resets the empty played-game mappings to null and keeps the others", async () => {
    await db.insert(playedGames).values([
      { npTitleId: "A", name: "A", npCommunicationIds: [] },
      { npTitleId: "B", name: "B", npCommunicationIds: [ID] },
      { npTitleId: "C", name: "C", npCommunicationIds: null },
    ]);
    await runDailyRefresh(db, gwWith(1.3), cfg, later, deps);
    const rows = await db.select().from(playedGames).orderBy(playedGames.npTitleId);
    expect(rows.map((r) => r.npCommunicationIds)).toEqual([null, [ID], null]);
  });

  it("keeps a known rare category when PSN sends none", async () => {
    const { defs, userTrophies } = makeTrophies(2);
    userTrophies.forEach((u) => (u.rareCategory = null));
    const gw = createFakePsn({
      titles: [makeRemoteTitle({ defined: { platinum: 0, gold: 0, silver: 0, bronze: 2 } })],
      titleData: { [ID]: { groups: [makeGroup("default")], defs, userTrophies } },
    });
    await runDailyRefresh(db, gw, cfg, later, deps);
    const rows = await db.select().from(trophies).where(eq(trophies.titleId, ID));
    expect(rows.map((r) => r.rareCategory)).toEqual([2, 2]);
  });

  it("keeps a known earned rate when PSN sends none, and replaces it by a real value", async () => {
    const { defs, userTrophies } = makeTrophies(2);
    userTrophies.forEach((u) => (u.earnedRate = null));
    const gw = createFakePsn({
      titles: [makeRemoteTitle({ defined: { platinum: 0, gold: 0, silver: 0, bronze: 2 } })],
      titleData: { [ID]: { groups: [makeGroup("default")], defs, userTrophies } },
    });
    await runDailyRefresh(db, gw, cfg, later, deps);
    const rates = async () => (await db.select().from(trophies).where(eq(trophies.titleId, ID))).map((r) => r.earnedRate);
    expect(await rates()).toEqual(["1.30", "1.30"]);
    await runDailyRefresh(db, gwWith(0.5), cfg, later, deps);
    expect(await rates()).toEqual(["0.50", "0.50"]);
  });

  it("the daily refresh downloads the images of a reloaded title", async () => {
    const DLC_ICON = "https://img.example/dlc-group.png";
    const fetchSpy = vi.fn(async (_url: string | URL | Request) => new Response(new Uint8Array([1]), { status: 200 }));
    const gw = gwWith(1.3, [makeGroup("default"), makeGroup("001", { iconUrl: DLC_ICON })], 2);
    const res = await runDailyRefresh(db, gw, cfg, later, { ...deps, fetchImpl: fetchSpy as unknown as typeof fetch });
    expect(res.status).toBe("success");
    expect(fetchSpy.mock.calls.map((c) => String(c[0]))).toContain(DLC_ICON);
    const [row] = await db.select().from(images).where(eq(images.url, DLC_ICON));
    expect(row.localPath).not.toBeNull();
  });

  it("the daily refresh never prunes images", async () => {
    const ORPHAN = "https://img.example/orphan.png";
    await db.insert(images).values({ url: ORPHAN, localPath: "psn/orphan.png" });
    await runDailyRefresh(db, gwWith(1.3), cfg, later, deps);
    expect(await db.select().from(images).where(eq(images.url, ORPHAN))).toHaveLength(1);
  });
});
