import { and, eq, isNotNull } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { settings, type PsnAuthStatus } from "@/src/db/schema";
import { decrypt, encrypt } from "@/src/lib/crypto";
import type { PsnTokens, StoredPsnTokens } from "@/src/psn/types";

export type Settings = {
  hideZero: boolean;
  bannerPath: string | null;
  bannerPosY: number;
  npssoSetAt: Date | null;
  psnAuthStatus: PsnAuthStatus;
  syncRequestedAt: Date | null;
  unobtainableListUrl: string;
  unobtainableRequestedAt: Date | null;
};

const ROW = eq(settings.id, 1);

export async function getSettings(db: Db): Promise<Settings> {
  const [row] = await db
    .select({
      hideZero: settings.hideZero,
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

export async function setBanner(db: Db, path: string | null, posY: number): Promise<void> {
  await db.update(settings).set({ bannerPath: path, bannerPosY: posY }).where(ROW);
}

export async function requestSync(db: Db, now: Date): Promise<void> {
  await db.update(settings).set({ syncRequestedAt: now }).where(ROW);
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

export async function takeSyncRequest(db: Db): Promise<boolean> {
  const rows = await db
    .update(settings)
    .set({ syncRequestedAt: null })
    .where(and(ROW, isNotNull(settings.syncRequestedAt)))
    .returning({ id: settings.id });
  return rows.length > 0;
}

export async function setPsnAuthStatus(db: Db, status: PsnAuthStatus): Promise<void> {
  await db.update(settings).set({ psnAuthStatus: status }).where(ROW);
}

export async function savePsnTokens(
  db: Db,
  key: Buffer,
  t: PsnTokens,
  npsso?: string,
  now: Date = new Date(),
): Promise<void> {
  await db
    .update(settings)
    .set({
      accessTokenEnc: encrypt(t.accessToken, key),
      accessExpiresAt: t.accessExpiresAt,
      refreshTokenEnc: encrypt(t.refreshToken, key),
      refreshExpiresAt: t.refreshExpiresAt,
      psnAuthStatus: "valid",
      ...(npsso === undefined ? {} : { npssoEnc: encrypt(npsso, key), npssoSetAt: now }),
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
