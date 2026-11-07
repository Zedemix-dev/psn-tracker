import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/src/db/client";
import { profile, syncRuns, titles, trophies } from "@/src/db/schema";
import type { AppConfig } from "@/src/lib/config";
import { savePsnTokens, getSettings } from "@/src/settings/repo";
import { isRetryable, withPacing } from "@/src/sync/retry";
import { runSync } from "@/src/sync/run";
import { createFakePsn } from "@/tests/fakes/psn";
import { makeGroup, makeRemoteTitle, makeTrophies } from "@/tests/fixtures/titles";
import { createTestDb } from "@/tests/helpers/db";

const now = new Date("2026-01-01T12:00:00Z");
let db: Db;
let mediaDir: string;
let cfg: AppConfig;
const sleep = vi.fn(async (_ms: number) => {});
const fetchImpl = vi.fn(async () => new Response(new Uint8Array([1]), { status: 200 })) as unknown as typeof fetch;
const deps = { sleep, fetchImpl };

const ids = ["NPWR00001_00", "NPWR00002_00", "NPWR00003_00"];

function fixture(failUserTrophiesFor?: string, earnedRate = 12.345) {
  const remote = ids.map((id) => makeRemoteTitle({ npCommunicationId: id, name: id }));
  const titleData = Object.fromEntries(
    ids.map((id) => {
      const t = makeTrophies(3, { earnedIds: [0] });
      t.userTrophies.forEach((u) => (u.earnedRate = earnedRate));
      return [id, { groups: [makeGroup("default")], ...t }];
    }),
  );
  return createFakePsn({
    titles: remote,
    titleData,
    failures: failUserTrophiesFor ? [{ method: "getUserTrophies", npCommunicationId: failUserTrophiesFor }] : [],
  });
}

async function seedTokens(accessExpiresAt = new Date("2099-01-01T00:00:00Z")) {
  await savePsnTokens(db, cfg.appSecret, {
    accessToken: "a",
    accessExpiresAt,
    refreshToken: "r",
    refreshExpiresAt: new Date("2099-06-01T00:00:00Z"),
  });
}

beforeEach(async () => {
  db = await createTestDb();
  mediaDir = await fs.mkdtemp(path.join(os.tmpdir(), "run-"));
  cfg = {
    databaseUrl: "pglite:memory",
    adminUsername: "a",
    adminPasswordHash: "h",
    appSecret: Buffer.alloc(32, 7),
    psnLanguage: "en-GB",
    mediaDir,
  };
  sleep.mockClear();
  await seedTokens();
});
afterEach(async () => {
  await fs.rm(mediaDir, { recursive: true, force: true });
});

describe("runSync", () => {
  it("syncs profile, titles and progress; first run is stored as first", async () => {
    const gw = fixture();
    const res = await runSync(db, gw, cfg, "manual", now, deps);

    expect(res.status).toBe("success");
    const [run] = await db.select().from(syncRuns);
    expect(run).toMatchObject({ kind: "first", status: "success", titlesTotal: 3, titlesDone: 3, trophiesUpdated: 9, error: null });
    expect(await db.select().from(titles)).toHaveLength(3);
    const [p] = await db.select().from(profile);
    expect(p.onlineId).toBe("Fake");
  });

  it("does not reload an unchanged title on the second sync", async () => {
    await runSync(db, fixture(), cfg, "manual", now, deps);
    const gw = fixture();
    const res = await runSync(db, gw, cfg, "scheduled", now, deps);

    expect(res.status).toBe("success");
    expect(gw.calls.filter((c) => c.startsWith("getTrophyDefs"))).toHaveLength(0);
    const runs = await db.select().from(syncRuns).orderBy(syncRuns.id);
    expect(runs[1]).toMatchObject({ kind: "scheduled", titlesDone: 3, trophiesUpdated: 0 });
  });

  it("marks auth expired and keeps data when refresh fails", async () => {
    await runSync(db, fixture(), cfg, "manual", now, deps);
    await seedTokens(new Date("2025-01-01T00:00:00Z"));
    const gw = createFakePsn({ failures: [{ method: "refresh" }] });

    const res = await runSync(db, gw, cfg, "scheduled", now, deps);

    expect(res).toMatchObject({ status: "error", error: "PSN token expired" });
    expect((await getSettings(db)).psnAuthStatus).toBe("expired");
    expect(await db.select().from(titles)).toHaveLength(3);
    expect(gw.calls).toEqual(["refresh:"]);
  });

  it("errors with PSN token missing and calls nothing else", async () => {
    const fresh = await createTestDb();
    const gw = fixture();
    const res = await runSync(fresh, gw, cfg, "manual", now, deps);
    expect(res).toMatchObject({ status: "error", error: "PSN token missing" });
    expect(gw.calls).toEqual([]);
  });

  it("skips a title whose user trophies are not found", async () => {
    await runSync(db, fixture(), cfg, "manual", now, deps);
    // Everything changes remotely: all three would reload; one fails.
    const gw = fixture(ids[1], 5);
    const changed = (await gw.getTitles({ accessToken: "x" })).map((t) => ({ ...t, trophySetVersion: "2.00" }));
    const gw2 = createFakePsn({
      titles: changed,
      titleData: Object.fromEntries(
        ids.map((id) => {
          const t = makeTrophies(3, { earnedIds: [0] });
          t.userTrophies.forEach((u) => (u.earnedRate = 5));
          return [id, { groups: [makeGroup("default")], ...t }];
        }),
      ),
      failures: [{ method: "getUserTrophies", npCommunicationId: ids[1] }],
    });

    const res = await runSync(db, gw2, cfg, "manual", now, deps);

    expect(res.status).toBe("success");
    const [run] = await db.select().from(syncRuns).where(eq(syncRuns.id, res.runId!));
    expect(run.error).toBe(`1 title skipped: ${ids[1]} (fake PSN failure: getUserTrophies ${ids[1]})`);
    expect(run.titlesDone).toBe(3);
    const rate = async (id: string) => (await db.select().from(trophies).where(eq(trophies.titleId, id)))[0].earnedRate;
    expect(await rate(ids[0])).toBe("5.00");
    expect(await rate(ids[2])).toBe("5.00");
    expect(await rate(ids[1])).toBe("12.35");
    const [t1] = await db.select().from(titles).where(eq(titles.npCommunicationId, ids[1]));
    expect(t1.trophySetVersion).toBe("1.00");
  });

  it("returns skipped for the second of two concurrent runs", async () => {
    const gw = fixture();
    const [a, b] = await Promise.all([
      runSync(db, gw, cfg, "manual", now, deps),
      runSync(db, gw, cfg, "manual", now, deps),
    ]);
    expect([a.status, b.status].sort()).toEqual(["skipped", "success"]);
    expect(await db.select().from(syncRuns)).toHaveLength(1);
  });

  it("skips while a recent run is running, and interrupts one older than 3 h", async () => {
    await db.insert(syncRuns).values({ kind: "manual", status: "running", startedAt: new Date(now.getTime() - 3600_000) });
    expect((await runSync(db, fixture(), cfg, "manual", now, deps)).status).toBe("skipped");

    await db.update(syncRuns).set({ startedAt: new Date(now.getTime() - 4 * 3600_000) });
    expect((await runSync(db, fixture(), cfg, "manual", now, deps)).status).toBe("success");
    const [old] = await db.select().from(syncRuns).orderBy(syncRuns.id);
    expect(old).toMatchObject({ status: "error", error: "Interrupted" });
  });

  it("ends in error when getTitles fails", async () => {
    const gw = createFakePsn({ failures: [{ method: "getTitles" }] });
    const res = await runSync(db, gw, cfg, "manual", now, deps);
    expect(res.status).toBe("error");
    expect(res.error).toContain("getTitles");
  });
});

describe("withPacing", () => {
  it("pauses 200 ms between calls and retries 429/5xx with 1, 2, 4 s then gives up", async () => {
    const pauses: number[] = [];
    let n = 0;
    const gw = createFakePsn();
    gw.getSummary = async () => {
      n++;
      throw Object.assign(new Error("boom"), { status: 503 });
    };
    const paced = withPacing(gw, async (ms) => void pauses.push(ms));
    await paced.getProfile({ accessToken: "x" }, "1");
    await expect(paced.getSummary({ accessToken: "x" })).rejects.toThrow("boom");
    expect(n).toBe(4);
    expect(pauses).toEqual([200, 1000, 200, 2000, 200, 4000, 200]);
  });

  it("does not retry other errors", async () => {
    let n = 0;
    const gw = createFakePsn();
    gw.getSummary = async () => {
      n++;
      throw new Error("Resource Not Found");
    };
    await expect(withPacing(gw, async () => {}).getSummary({ accessToken: "x" })).rejects.toThrow();
    expect(n).toBe(1);
    expect(isRetryable(new Error("HTTP 429 Too Many Requests"))).toBe(true);
    expect(isRetryable(new Error("Empty trophy list for NPWR00500_00"))).toBe(false);
  });
});

describe("runSync robustness", () => {
  function failingFinalWrite(real: Db): Db {
    return new Proxy(real, {
      get(target, prop, recv) {
        if (prop !== "update") return Reflect.get(target, prop, recv);
        return (table: never) => {
          const builder = target.update(table);
          return new Proxy(builder, {
            get(b, p, r) {
              if (p !== "set") return Reflect.get(b, p, r);
              return (v: { status?: string; error?: string }) => {
                if (v.status === "success" || (v.status === "error" && v.error !== "Interrupted")) {
                  throw new Error("db down");
                }
                return b.set(v as never);
              };
            },
          });
        };
      },
    });
  }

  it("resolves to error when the final status write fails", async () => {
    const res = await runSync(failingFinalWrite(db), fixture(), cfg, "manual", now, deps);
    expect(res).toMatchObject({ status: "error", error: "db down" });
  });

  it("releases the guard after an error", async () => {
    const empty = await createTestDb();
    expect((await runSync(empty, fixture(), cfg, "manual", now, deps)).status).toBe("error");
    expect((await runSync(empty, fixture(), cfg, "manual", now, deps)).status).toBe("error");
  });

  it("sets finishedAt from the injected clock", async () => {
    const later = new Date(now.getTime() + 90_000);
    const res = await runSync(db, fixture(), cfg, "manual", now, { ...deps, clock: () => later });
    const [run] = await db.select().from(syncRuns).where(eq(syncRuns.id, res.runId!));
    expect(run.finishedAt!.getTime()).toBeGreaterThan(run.startedAt.getTime());
    expect(run.finishedAt).toEqual(later);
  });
});

describe("isRetryable", () => {
  it("classifies errors", () => {
    expect(isRetryable(new Error("Found 500 trophies"))).toBe(false);
    expect(isRetryable(new TypeError("fetch failed"))).toBe(true);
    expect(isRetryable(new Error("Service Unavailable"))).toBe(true);
    expect(isRetryable(Object.assign(new Error("x"), { cause: { code: "UND_ERR_SOCKET" } }))).toBe(true);
    expect(isRetryable(Object.assign(new Error("x"), { status: 503 }))).toBe(true);
    expect(isRetryable(Object.assign(new Error("x"), { status: 401 }))).toBe(false);
    expect(isRetryable(new Error("Resource Not Found"))).toBe(false);
  });
});
