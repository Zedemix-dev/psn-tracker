import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/src/db/client";
import { jobState, syncRuns } from "@/src/db/schema";
import type { AppConfig } from "@/src/lib/config";
import type { PsnGateway } from "@/src/psn/gateway";
import { getSettings, requestSync } from "@/src/settings/repo";
import type { SyncRunResult } from "@/src/sync/run";
import { decideNextJob, markInterruptedRuns, tick, type TickDeps } from "@/src/worker/scheduler";
import { createTestDb } from "@/tests/helpers/db";

const H = 60 * 60 * 1000;
const now = new Date("2026-01-01T08:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);
const fresh = { lastScheduledAt: ago(1 * H), lastDailyAt: ago(1 * H), manualRequested: false };

describe("decideNextJob", () => {
  it("puts a manual request before a due scheduled run", () => {
    expect(decideNextJob({ lastScheduledAt: null, lastDailyAt: null, manualRequested: true }, now)).toBe("manual");
  });

  it("runs scheduled at exactly 6 h, not before", () => {
    expect(decideNextJob({ ...fresh, lastScheduledAt: ago(6 * H - 60_000) }, now)).toBeNull();
    expect(decideNextJob({ ...fresh, lastScheduledAt: ago(6 * H) }, now)).toBe("scheduled");
  });

  it("runs scheduled when it never ran", () => {
    expect(decideNextJob({ ...fresh, lastScheduledAt: null }, now)).toBe("scheduled");
  });

  it("runs daily when it never ran and scheduled is up to date", () => {
    expect(decideNextJob({ ...fresh, lastDailyAt: null }, now)).toBe("daily");
  });

  it("runs daily at 24 h, not before", () => {
    expect(decideNextJob({ ...fresh, lastDailyAt: ago(24 * H - 60_000) }, now)).toBeNull();
    expect(decideNextJob({ ...fresh, lastDailyAt: ago(24 * H) }, now)).toBe("daily");
  });
});

describe("tick", () => {
  let db: Db;
  let runSync: ReturnType<typeof vi.fn>;
  let runDailyRefresh: ReturnType<typeof vi.fn>;
  let refreshUnobtainableList: ReturnType<typeof vi.fn>;
  let applyUnobtainable: ReturnType<typeof vi.fn>;
  let deps: TickDeps;
  const ok: SyncRunResult = { status: "success", runId: 1 };

  beforeEach(async () => {
    db = await createTestDb();
    runSync = vi.fn(async () => ok);
    runDailyRefresh = vi.fn(async () => ok);
    refreshUnobtainableList = vi.fn(async () => {});
    applyUnobtainable = vi.fn(async () => {});
    deps = {
      db,
      gw: {} as PsnGateway,
      cfg: {} as AppConfig,
      runSync: runSync as unknown as TickDeps["runSync"],
      runDailyRefresh: runDailyRefresh as unknown as TickDeps["runDailyRefresh"],
      refreshUnobtainableList: refreshUnobtainableList as unknown as TickDeps["refreshUnobtainableList"],
      applyUnobtainable: applyUnobtainable as unknown as TickDeps["applyUnobtainable"],
    };
  });

  const stateOf = async (key: string) =>
    (await db.select().from(jobState).where(eq(jobState.key, key)))[0]?.lastRunAt ?? null;

  it("runs only scheduled when scheduled and daily are both due, daily at the next tick", async () => {
    await tick(deps, now);
    expect(runSync).toHaveBeenCalledTimes(1);
    expect(runSync.mock.calls[0].slice(3, 5)).toEqual(["scheduled", now]);
    expect(runDailyRefresh).not.toHaveBeenCalled();
    expect(await stateOf("scheduled")).toEqual(now);

    await tick(deps, now);
    expect(runSync).toHaveBeenCalledTimes(1);
    expect(runDailyRefresh).toHaveBeenCalledTimes(1);
    expect(await stateOf("daily")).toEqual(now);

    await tick(deps, now);
    expect(runSync).toHaveBeenCalledTimes(1);
    expect(runDailyRefresh).toHaveBeenCalledTimes(1);
  });

  it("runs a manual request first, consumes it and counts it as the scheduled run", async () => {
    await requestSync(db, now);
    await tick(deps, now);
    expect(runSync.mock.calls[0][3]).toBe("manual");
    expect((await getSettings(db)).syncRequestedAt).toBeNull();
    expect(await stateOf("scheduled")).toEqual(now);
    expect(await stateOf("daily")).toBeNull();
  });

  it("re-queues a manual request whose run was skipped", async () => {
    runSync.mockResolvedValueOnce({ status: "skipped" });
    await requestSync(db, now);
    await tick(deps, now);
    expect((await getSettings(db)).syncRequestedAt).toEqual(now);
  });

  it("does not re-queue when the manual run failed", async () => {
    runSync.mockResolvedValueOnce({ status: "error", error: "boom" });
    await requestSync(db, now);
    await tick(deps, now);
    expect((await getSettings(db)).syncRequestedAt).toBeNull();
  });

  it("does nothing when nothing is due", async () => {
    await db.insert(jobState).values([
      { key: "scheduled", lastRunAt: ago(1 * H) },
      { key: "daily", lastRunAt: ago(1 * H) },
    ]);
    await tick(deps, now);
    expect(runSync).not.toHaveBeenCalled();
    expect(runDailyRefresh).not.toHaveBeenCalled();
  });

  const markFresh = () =>
    db.insert(jobState).values([
      { key: "scheduled", lastRunAt: ago(1 * H) },
      { key: "daily", lastRunAt: ago(1 * H) },
    ]);

  it("refreshes the list before the PSN job", async () => {
    await tick(deps, now);
    expect(refreshUnobtainableList).toHaveBeenCalledTimes(1);
    expect(refreshUnobtainableList.mock.calls[0].slice(0, 2)).toEqual([db, now]);
    expect(refreshUnobtainableList.mock.invocationCallOrder[0]).toBeLessThan(runSync.mock.invocationCallOrder[0]);
  });

  it("runs the PSN job when the list refresh throws", async () => {
    const log = vi.fn();
    refreshUnobtainableList.mockRejectedValueOnce(new Error("offline"));
    await tick({ ...deps, log }, now);
    expect(runSync).toHaveBeenCalledTimes(1);
    expect(log.mock.calls.some(([l]) => String(l).includes("offline"))).toBe(true);
  });

  it("applies the marks after a job", async () => {
    await tick(deps, now);
    expect(applyUnobtainable).toHaveBeenCalledTimes(1);
    expect(applyUnobtainable).toHaveBeenCalledWith(db);
    expect(applyUnobtainable.mock.invocationCallOrder[0]).toBeGreaterThan(runSync.mock.invocationCallOrder[0]);

    applyUnobtainable.mockClear();
    await tick(deps, now); // daily is due now
    expect(runDailyRefresh).toHaveBeenCalledTimes(1);
    expect(applyUnobtainable).toHaveBeenCalledTimes(1);
    expect(applyUnobtainable.mock.invocationCallOrder[0]).toBeGreaterThan(runDailyRefresh.mock.invocationCallOrder[0]);
  });

  it("applies the marks after a failed job", async () => {
    runSync.mockResolvedValueOnce({ status: "error", error: "x" });
    await tick(deps, now);
    expect(applyUnobtainable).toHaveBeenCalledTimes(1);
  });

  it("does not apply after a skipped job", async () => {
    runSync.mockResolvedValueOnce({ status: "skipped" });
    await tick(deps, now);
    expect(applyUnobtainable).not.toHaveBeenCalled();
  });

  it("still logs and carries on when applying the marks throws", async () => {
    const log = vi.fn();
    applyUnobtainable.mockRejectedValueOnce(new Error("apply-boom"));
    await expect(tick({ ...deps, log }, now)).resolves.toBeUndefined();
    expect(log.mock.calls.some(([l]) => String(l).includes("apply-boom"))).toBe(true);
  });

  it("still refreshes the list when no job is due", async () => {
    await markFresh();
    await tick(deps, now);
    expect(refreshUnobtainableList).toHaveBeenCalledTimes(1);
    expect(runSync).not.toHaveBeenCalled();
    expect(applyUnobtainable).not.toHaveBeenCalled();
  });
});

describe("markInterruptedRuns", () => {
  it("marks running rows as Interrupted and leaves finished ones alone", async () => {
    const db = await createTestDb();
    await db.insert(syncRuns).values([
      { kind: "manual", status: "running", startedAt: ago(1 * H) },
      { kind: "daily", status: "success", startedAt: ago(2 * H), finishedAt: ago(2 * H) },
    ]);
    await markInterruptedRuns(db, now);
    const rows = await db.select().from(syncRuns).orderBy(syncRuns.id);
    expect(rows[0]).toMatchObject({ status: "error", error: "Interrupted", finishedAt: now });
    expect(rows[1]).toMatchObject({ status: "success", error: null });
  });
});
