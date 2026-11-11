import { and, eq, gt, inArray, lte, notInArray } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { profile, settings, syncRuns, titles, type SyncKind } from "@/src/db/schema";
import type { AppConfig } from "@/src/lib/config";
import type { PsnAuth, PsnGateway } from "@/src/psn/gateway";
import { getValidAuth } from "@/src/psn/tokens";
import { loadTitleState, titleNeedsReload } from "@/src/sync/diff";
import { syncCatalog } from "@/src/sync/catalog";
import { cacheImages } from "@/src/sync/image-cache";
import { syncPlayedGames } from "@/src/sync/played";
import { defaultSleep, withPacing, type Sleep } from "@/src/sync/retry";
import { refreshUserState } from "@/src/sync/user-state";
import { syncTitle, upsertTitleRow } from "@/src/sync/title";

export type SyncRunResult = { status: "success" | "error" | "skipped"; runId?: number; error?: string };
export type SyncDeps = { sleep?: Sleep; fetchImpl?: typeof fetch; clock?: () => Date };

export type RunProgress = {
  setTotal(n: number): Promise<void>;
  titleDone(trophiesUpdated: number): Promise<void>;
};
/** What a run body receives: a paced gateway, valid auth, and a list to record per-title failures in. */
export type RunContext = { gw: PsnGateway; auth: PsnAuth; progress: RunProgress; failures: string[] };

const STALE_RUN_MS = 3 * 60 * 60 * 1000;

let active: Promise<SyncRunResult> | null = null;

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

export const describeFailure = (id: string, err: unknown) => `${id} (${errorMessage(err)})`;

function failureSummary(failures: string[]): string | null {
  return failures.length === 0
    ? null
    : `${failures.length} title${failures.length > 1 ? "s" : ""} skipped: ${failures.join(", ")}`;
}

/**
 * Single-flight run lifecycle shared by runSync and runDailyRefresh: an in-process
 * guard plus the `running` row in syncRuns (rows older than 3 h are marked Interrupted).
 */
export async function executeRun(
  db: Db,
  gw: PsnGateway,
  cfg: AppConfig,
  resolveKind: () => Promise<SyncKind>,
  now: Date,
  deps: SyncDeps | undefined,
  body: (ctx: RunContext) => Promise<void>,
): Promise<SyncRunResult> {
  if (active) return { status: "skipped" };
  const clock = deps?.clock ?? (() => new Date());
  const run = (async (): Promise<SyncRunResult> => {
    const staleBefore = new Date(now.getTime() - STALE_RUN_MS);
    await db
      .update(syncRuns)
      .set({ status: "error", error: "Interrupted", finishedAt: clock() })
      .where(and(eq(syncRuns.status, "running"), lte(syncRuns.startedAt, staleBefore)));
    const running = await db
      .select({ id: syncRuns.id })
      .from(syncRuns)
      .where(and(eq(syncRuns.status, "running"), gt(syncRuns.startedAt, staleBefore)));
    if (running.length > 0) return { status: "skipped" };

    const [row] = await db
      .insert(syncRuns)
      .values({ kind: await resolveKind(), status: "running", startedAt: now })
      .returning({ id: syncRuns.id });
    const runId = row.id;
    const paced = withPacing(gw, deps?.sleep ?? defaultSleep);
    const failures: string[] = [];
    let done = 0;
    let updated = 0;
    const progress: RunProgress = {
      setTotal: async (n) => {
        await db.update(syncRuns).set({ titlesTotal: n }).where(eq(syncRuns.id, runId));
      },
      titleDone: async (n) => {
        done += 1;
        updated += n;
        await db
          .update(syncRuns)
          .set({ titlesDone: done, trophiesUpdated: updated })
          .where(eq(syncRuns.id, runId));
      },
    };
    const writeFinal = async (status: "success" | "error", error: string | null) => {
      await db.update(syncRuns).set({ status, finishedAt: clock(), error }).where(eq(syncRuns.id, runId));
    };
    try {
      const auth = await getValidAuth(db, paced, cfg.appSecret, now);
      if (auth === "expired") throw new Error("PSN token expired");
      if (auth === "missing") throw new Error("PSN token missing");
      await body({ gw: paced, auth, progress, failures });
      await writeFinal("success", failureSummary(failures));
      return { status: "success", runId };
    } catch (err) {
      const message = errorMessage(err);
      try {
        await writeFinal("error", message);
      } catch {
        // Best-effort: the DB itself may be the problem; never reject nor hold the guard.
      }
      return { status: "error", runId, error: message };
    }
  })();
  active = run;
  try {
    return await run;
  } finally {
    active = null;
  }
}

export async function runSync(
  db: Db,
  gw: PsnGateway,
  cfg: AppConfig,
  kind: SyncKind,
  now: Date = new Date(),
  deps?: SyncDeps,
): Promise<SyncRunResult> {
  const resolveKind = async (): Promise<SyncKind> =>
    (await db.select({ id: titles.npCommunicationId }).from(titles).limit(1)).length === 0 ? "first" : kind;

  return executeRun(db, gw, cfg, resolveKind, now, deps, async ({ gw: paced, auth, progress, failures }) => {
    const summary = await paced.getSummary(auth);
    const me = await paced.getProfile(auth, summary.accountId);
    const profileCols = {
      accountId: summary.accountId,
      onlineId: me.onlineId,
      avatarUrl: me.avatarUrl,
      level: summary.level,
      levelProgress: summary.levelProgress,
      tier: summary.tier,
      earnedPlatinum: summary.earned.platinum,
      earnedGold: summary.earned.gold,
      earnedSilver: summary.earned.silver,
      earnedBronze: summary.earned.bronze,
      updatedAt: now,
    };
    await db
      .insert(profile)
      .values({ id: 1, ...profileCols })
      .onConflictDoUpdate({ target: profile.id, set: profileCols });

    const remoteTitles = await paced.getTitles(auth);
    await progress.setTotal(remoteTitles.length);

    // A new PSN language means every list must be reloaded to get its definitions in that language.
    // First start with this version: no language stored yet, so just note it and reload nothing.
    const [stored0] = await db.select({ language: settings.psnLanguage }).from(settings).where(eq(settings.id, 1));
    const languageChanged = !!stored0?.language && stored0.language !== cfg.psnLanguage;

    const reloaded = new Set<string>();
    const failedInLanguageRun: string[] = [];
    for (const remote of remoteTitles) {
      let updated = 0;
      try {
        const stored = await loadTitleState(db, remote.npCommunicationId);
        if (languageChanged || titleNeedsReload(stored, remote)) {
          updated = (await syncTitle(db, paced, auth, remote, now)).trophiesUpdated;
          reloaded.add(remote.npCommunicationId);
        } else {
          await upsertTitleRow(db, remote, now);
        }
      } catch (err) {
        failures.push(describeFailure(remote.npCommunicationId, err));
        if (languageChanged) failedInLanguageRun.push(remote.npCommunicationId);
      }
      await progress.titleDone(updated);
    }

    // A title that failed while the language changed still has old-language definitions: a null
    // syncedAt makes titleNeedsReload reload that title (and only it) on the next run.
    if (failedInLanguageRun.length > 0) {
      await db.update(titles).set({ syncedAt: null }).where(inArray(titles.npCommunicationId, failedInLanguageRun));
    }
    // Stored only once the titles have been gone through: a run that throws earlier retries the reload.
    if (stored0 && stored0.language !== cfg.psnLanguage) {
      await db.update(settings).set({ psnLanguage: cfg.psnLanguage }).where(eq(settings.id, 1));
    }

    // A list PSN no longer returns (PS4 lets you delete 0% lists) leaves the site. Each remote
    // title sets `hidden` above, so a list that comes back is shown again. An empty answer hides nothing.
    if (remoteTitles.length > 0) {
      await db
        .update(titles)
        .set({ hidden: true })
        .where(notInArray(titles.npCommunicationId, remoteTitles.map((t) => t.npCommunicationId)));
    }

    const { replayedTitleIds } = await syncPlayedGames(db, paced, auth);
    // A replayed game moves progress counters without touching the title's own change markers.
    const toRefresh = replayedTitleIds.filter((id) => !reloaded.has(id));
    if (toRefresh.length > 0) {
      const rows = await db
        .select({ id: titles.npCommunicationId, npServiceName: titles.npServiceName })
        .from(titles)
        .where(and(inArray(titles.npCommunicationId, toRefresh), eq(titles.hidden, false)));
      for (const row of rows) {
        if (row.npServiceName !== "trophy2") continue;
        try {
          await refreshUserState(db, paced, auth, { npCommunicationId: row.id, npServiceName: "trophy2" });
        } catch (err) {
          failures.push(describeFailure(row.id, err));
        }
      }
    }
    await syncCatalog(db, paced, auth, "missing", now);
    const img = await cacheImages(db, cfg.mediaDir, deps?.fetchImpl);
    console.log(
      `[worker] images: ${img.downloaded} downloaded, ${img.failed} failed, ${img.thumbs} thumbnails, ${img.tiles} tile colours`,
    );
  });
}
