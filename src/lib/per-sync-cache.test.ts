import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/src/db/client";
import { syncRuns } from "@/src/db/schema";
import { createTestDb } from "@/tests/helpers/db";
import { cachedUntilNextRun } from "./per-sync-cache";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe("cachedUntilNextRun", () => {
  it("loads once for two calls with no new run", async () => {
    const load = vi.fn(async () => ({ n: 1 }));
    const a = await cachedUntilNextRun(db, "k", load);
    const b = await cachedUntilNextRun(db, "k", load);
    expect(load).toHaveBeenCalledTimes(1);
    expect(b).toBe(a);
  });

  it("keeps one entry per key", async () => {
    const x = vi.fn(async () => "x");
    const y = vi.fn(async () => "y");
    expect(await cachedUntilNextRun(db, "x", x)).toBe("x");
    expect(await cachedUntilNextRun(db, "y", y)).toBe("y");
    expect(await cachedUntilNextRun(db, "x", x)).toBe("x");
    expect(x).toHaveBeenCalledTimes(1);
    expect(y).toHaveBeenCalledTimes(1);
  });

  it("reloads when a run finishes, in success or in error", async () => {
    const load = vi.fn(async () => 1);
    await cachedUntilNextRun(db, "k", load);
    const [run] = await db.insert(syncRuns).values({ kind: "daily", status: "running" }).returning();
    await cachedUntilNextRun(db, "k", load); // a run started: the row count changed
    expect(load).toHaveBeenCalledTimes(2);
    await cachedUntilNextRun(db, "k", load);
    expect(load).toHaveBeenCalledTimes(2);

    await db.update(syncRuns).set({ status: "success", finishedAt: new Date("2026-11-11T10:00:00Z") }).where(eq(syncRuns.id, run.id));
    await cachedUntilNextRun(db, "k", load);
    expect(load).toHaveBeenCalledTimes(3);

    await db.update(syncRuns).set({ status: "error", finishedAt: new Date("2026-11-11T11:00:00Z") }).where(eq(syncRuns.id, run.id));
    await cachedUntilNextRun(db, "k", load);
    expect(load).toHaveBeenCalledTimes(4);
  });

  it("shares nothing between two Db instances", async () => {
    const other = await createTestDb();
    const load = vi.fn(async () => 1);
    await cachedUntilNextRun(db, "k", load);
    await cachedUntilNextRun(other, "k", load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not keep a failed load", async () => {
    const load = vi.fn<() => Promise<number>>().mockRejectedValueOnce(new Error("boom")).mockResolvedValue(2);
    await expect(cachedUntilNextRun(db, "k", load)).rejects.toThrow("boom");
    expect(await cachedUntilNextRun(db, "k", load)).toBe(2);
  });
});
