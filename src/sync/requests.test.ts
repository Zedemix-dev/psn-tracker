import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/src/db/client";
import { syncRuns } from "@/src/db/schema";
import { requestSync } from "@/src/settings/repo";
import { getSyncStatus } from "@/src/sync/requests";
import { createTestDb } from "@/tests/helpers/db";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

const T1 = new Date("2026-11-05T10:00:00Z");
const T2 = new Date("2026-11-07T08:27:00Z");

describe("getSyncStatus", () => {
  it("is idle with nothing recorded", async () => {
    expect(await getSyncStatus(db)).toEqual({
      status: "idle",
      lastSuccessAt: null,
      error: null,
      titlesDone: 0,
      titlesTotal: 0,
    });
  });

  it("is queued when a request waits and no sync is running", async () => {
    await requestSync(db, T2);
    expect((await getSyncStatus(db)).status).toBe("queued");
  });

  it("is running, with progress, even when a request is also waiting", async () => {
    await requestSync(db, T2);
    await db.insert(syncRuns).values({ kind: "manual", status: "running", titlesDone: 3, titlesTotal: 40 });
    expect(await getSyncStatus(db)).toMatchObject({ status: "running", titlesDone: 3, titlesTotal: 40 });
  });

  it("reports the error of the latest finished run", async () => {
    await db.insert(syncRuns).values({ kind: "manual", status: "error", startedAt: T1, finishedAt: T1, error: "PSN down" });
    expect(await getSyncStatus(db)).toMatchObject({ status: "error", error: "PSN down", lastSuccessAt: null });
  });

  it("is idle again once a success follows the error", async () => {
    await db.insert(syncRuns).values({ kind: "manual", status: "error", startedAt: T1, finishedAt: T1, error: "PSN down" });
    await db.insert(syncRuns).values({ kind: "manual", status: "success", startedAt: T2, finishedAt: T2 });
    expect(await getSyncStatus(db)).toMatchObject({
      status: "idle",
      error: null,
      lastSuccessAt: T2.toISOString(),
    });
  });

  it("counts a success carrying a skipped-titles summary as a success", async () => {
    await db.insert(syncRuns).values({ kind: "scheduled", status: "success", startedAt: T1, finishedAt: T1, error: "2 titles skipped" });
    expect(await getSyncStatus(db)).toMatchObject({ status: "idle", error: null, lastSuccessAt: T1.toISOString() });
  });

  it("keeps the last success date while an error is the latest run", async () => {
    await db.insert(syncRuns).values({ kind: "manual", status: "success", startedAt: T1, finishedAt: T1 });
    await db.insert(syncRuns).values({ kind: "manual", status: "error", startedAt: T2, finishedAt: T2, error: "boom" });
    expect(await getSyncStatus(db)).toMatchObject({ status: "error", error: "boom", lastSuccessAt: T1.toISOString() });
  });
});
