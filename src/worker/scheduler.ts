import { eq } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { jobState, syncRuns } from "@/src/db/schema";
import type { AppConfig } from "@/src/lib/config";
import type { PsnGateway } from "@/src/psn/gateway";
import { requestSync, takeSyncRequest } from "@/src/settings/repo";
import { runDailyRefresh } from "@/src/sync/daily";
import { runSync } from "@/src/sync/run";

export type JobKind = "manual" | "scheduled" | "daily";
export type JobState = { lastScheduledAt: Date | null; lastDailyAt: Date | null; manualRequested: boolean };

const SCHEDULED_EVERY_MS = 6 * 60 * 60 * 1000;
const DAILY_EVERY_MS = 24 * 60 * 60 * 1000;

const due = (last: Date | null, every: number, now: Date) =>
  last === null || now.getTime() - last.getTime() >= every;

/** Priority: manual, then scheduled (every 6 h), then daily (every 24 h). */
export function decideNextJob(state: JobState, now: Date): JobKind | null {
  if (state.manualRequested) return "manual";
  if (due(state.lastScheduledAt, SCHEDULED_EVERY_MS, now)) return "scheduled";
  if (due(state.lastDailyAt, DAILY_EVERY_MS, now)) return "daily";
  return null;
}

export type TickDeps = {
  db: Db;
  gw: PsnGateway;
  cfg: AppConfig;
  runSync: typeof runSync;
  runDailyRefresh: typeof runDailyRefresh;
  log?: (line: string) => void;
};

export const defaultTickDeps = (base: Pick<TickDeps, "db" | "gw" | "cfg">): TickDeps => ({
  ...base,
  runSync,
  runDailyRefresh,
  log: (line) => console.log(line),
});

async function markRun(db: Db, key: string, at: Date): Promise<void> {
  await db
    .insert(jobState)
    .values({ key, lastRunAt: at })
    .onConflictDoUpdate({ target: jobState.key, set: { lastRunAt: at } });
}

/** One scheduler iteration: runs at most one job. jobState is updated when the job starts. */
export async function tick(deps: TickDeps, now: Date): Promise<void> {
  const { db, gw, cfg } = deps;
  const rows = await db.select().from(jobState);
  const lastOf = (key: string) => rows.find((r) => r.key === key)?.lastRunAt ?? null;

  const manualRequested = await takeSyncRequest(db);
  const kind = decideNextJob(
    { lastScheduledAt: lastOf("scheduled"), lastDailyAt: lastOf("daily"), manualRequested },
    now,
  );
  if (!kind) return;

  await markRun(db, kind === "daily" ? "daily" : "scheduled", now);
  deps.log?.(`[worker] ${kind} started`);
  const t0 = Date.now();
  const result = kind === "daily" ? await deps.runDailyRefresh(db, gw, cfg, now) : await deps.runSync(db, gw, cfg, kind, now);
  if (kind === "manual" && result.status === "skipped") await requestSync(db, now);
  deps.log?.(
    `[worker] ${kind} ${result.status} in ${Date.now() - t0} ms${result.error ? `: ${result.error}` : ""}`,
  );
}

/** Rows still `running` at startup belong to a dead process (single worker). */
export async function markInterruptedRuns(db: Db, now: Date): Promise<void> {
  await db
    .update(syncRuns)
    .set({ status: "error", error: "Interrupted", finishedAt: now })
    .where(eq(syncRuns.status, "running"));
}
