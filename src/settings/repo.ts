import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { settings, type AdvisorDlc, type PsnAuthStatus } from "@/src/db/schema";
import { decrypt, encrypt } from "@/src/lib/crypto";
import type { PsnTokens, StoredPsnTokens } from "@/src/psn/types";

export type Settings = {
  hideZero: boolean;
  advisorHideUnobtainable: boolean;
  advisorDlc: AdvisorDlc;
  bannerPath: string | null;
  bannerPosY: number;
  npssoSetAt: Date | null;
  psnAuthStatus: PsnAuthStatus;
  syncRequestedAt: Date | null;
  unobtainableListUrl: string;
  unobtainableRequestedAt: Date | null;
};

const ROW = eq(settings.id, 1);
const MAX_SYNC_REQUEST_FAILURES = 3;

export async function getSettings(db: Db): Promise<Settings> {
  const [row] = await db
    .select({
      hideZero: settings.hideZero,
      advisorHideUnobtainable: settings.advisorHideUnobtainable,
      advisorDlc: settings.advisorDlc,
      bannerPath: settings.bannerPath,
      bannerPosY: settings.bannerPosY,
      npssoSetAt: settings.npssoSetAt,
      psnAuthStatus: settings.psnAuthStatus,
      syncRequestedAt: settings.syncRequestedAt,
      unobtainableListUrl: settings.unobtainableListUrl,
      unobtainableRequestedAt: settings.unobtainableRequestedAt,
    })
    .from(settings)
    .where(ROW);
  return row;
}

export async function setHideZero(db: Db, on: boolean): Promise<void> {
  await db.update(settings).set({ hideZero: on }).where(ROW);
}

export async function setAdvisorHideUnobtainable(db: Db, on: boolean): Promise<void> {
  await db.update(settings).set({ advisorHideUnobtainable: on }).where(ROW);
}

export async function setAdvisorDlc(db: Db, mode: AdvisorDlc): Promise<void> {
  await db.update(settings).set({ advisorDlc: mode }).where(ROW);
}

export async function setBanner(db: Db, path: string | null, posY: number): Promise<void> {
  await db.update(settings).set({ bannerPath: path, bannerPosY: posY }).where(ROW);
}

export async function requestSync(db: Db, now: Date): Promise<void> {
  await db.update(settings).set({ syncRequestedAt: now, syncRequestFailures: 0 }).where(ROW);
}

export async function saveUnobtainableUrl(db: Db, url: string, now: Date): Promise<void> {
  await db.update(settings).set({ unobtainableListUrl: url, unobtainableRequestedAt: now }).where(ROW);
}

/** Clears the request only if it still holds the value read before the download. */
export async function clearUnobtainableRequest(db: Db, seen: Date): Promise<void> {
  await db
    .update(settings)
    .set({ unobtainableRequestedAt: null })
    .where(and(ROW, eq(settings.unobtainableRequestedAt, seen)));
}

/** The pending manual request, left in place: it lives until its run ends. */
export async function peekSyncRequest(db: Db): Promise<Date | null> {
  const [row] = await db.select({ at: settings.syncRequestedAt }).from(settings).where(ROW);
  return row?.at ?? null;
}

/** Ends the request and resets the failure count, only if it still holds the value read before the run. */
export async function clearSyncRequest(db: Db, seen: Date): Promise<void> {
  await db
    .update(settings)
    .set({ syncRequestedAt: null, syncRequestFailures: 0 })
    .where(and(ROW, eq(settings.syncRequestedAt, seen)));
}

/** Counts one failed run for the request; at 3 the request is given up. Returns the new total. */
export async function failSyncRequest(db: Db, seen: Date): Promise<number> {
  const [row] = await db
    .update(settings)
    .set({ syncRequestFailures: sql`${settings.syncRequestFailures} + 1` })
    .where(and(ROW, eq(settings.syncRequestedAt, seen)))
    .returning({ n: settings.syncRequestFailures });
  if (!row) return 0;
  if (row.n >= MAX_SYNC_REQUEST_FAILURES) await clearSyncRequest(db, seen);
  return row.n;
}

export async function setPsnAuthStatus(db: Db, status: PsnAuthStatus): Promise<void> {
  await db.update(settings).set({ psnAuthStatus: status }).where(ROW);
}

export async function savePsnTokens(
  db: Db,
  key: Buffer,
  t: PsnTokens,
  npssoSetAt?: Date,
): Promise<void> {
  await db
    .update(settings)
    .set({
      accessTokenEnc: encrypt(t.accessToken, key),
      accessExpiresAt: t.accessExpiresAt,
      refreshTokenEnc: encrypt(t.refreshToken, key),
      refreshExpiresAt: t.refreshExpiresAt,
      psnAuthStatus: "valid",
      ...(npssoSetAt === undefined ? {} : { npssoSetAt }),
    })
    .where(ROW);
}

export async function loadPsnTokens(db: Db, key: Buffer): Promise<StoredPsnTokens | null> {
  const [row] = await db.select().from(settings).where(ROW);
  if (!row?.refreshTokenEnc || !row.refreshExpiresAt) return null;
  if (!row.accessTokenEnc || !row.accessExpiresAt) return null;
  return {
    accessToken: decrypt(row.accessTokenEnc, key),
    accessExpiresAt: row.accessExpiresAt,
    refreshToken: decrypt(row.refreshTokenEnc, key),
    refreshExpiresAt: row.refreshExpiresAt,
    npssoSetAt: row.npssoSetAt,
  };
}
