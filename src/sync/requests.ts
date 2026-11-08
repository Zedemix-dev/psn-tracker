import { and, desc, eq, isNotNull, ne } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { syncRuns } from "@/src/db/schema";
import { getSettings } from "@/src/settings/repo";

export type SyncState = "idle" | "queued" | "running" | "error";

export type SyncStatus = {
  status: SyncState;
  lastSuccessAt: string | null;
  error: string | null;
  titlesDone: number;
  titlesTotal: number;
};

export async function getSyncStatus(db: Db): Promise<SyncStatus> {
  const [running] = await db
    .select({ done: syncRuns.titlesDone, total: syncRuns.titlesTotal })
    .from(syncRuns)
    .where(eq(syncRuns.status, "running"))
    .limit(1);
  const [success] = await db
    .select({ at: syncRuns.finishedAt })
    .from(syncRuns)
    .where(and(eq(syncRuns.status, "success"), isNotNull(syncRuns.finishedAt)))
    .orderBy(desc(syncRuns.finishedAt))
    .limit(1);
  const lastSuccessAt = success?.at?.toISOString() ?? null;

  if (running) {
    return { status: "running", lastSuccessAt, error: null, titlesDone: running.done, titlesTotal: running.total };
  }
  const idle = { lastSuccessAt, error: null, titlesDone: 0, titlesTotal: 0 };
  if ((await getSettings(db)).syncRequestedAt) return { status: "queued", ...idle };

  const [latest] = await db
    .select({ status: syncRuns.status, error: syncRuns.error })
    .from(syncRuns)
    .where(and(ne(syncRuns.status, "running"), isNotNull(syncRuns.finishedAt)))
    .orderBy(desc(syncRuns.finishedAt), desc(syncRuns.id))
    .limit(1);
  if (latest?.status === "error") return { status: "error", ...idle, error: latest.error ?? "Unknown error" };
  return { status: "idle", ...idle };
}
