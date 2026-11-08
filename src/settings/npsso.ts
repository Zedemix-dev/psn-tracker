import type { Db } from "@/src/db/client";
import type { PsnGateway } from "@/src/psn/gateway";
import { connectWithNpsso, NPSSO_PATTERN } from "@/src/psn/tokens";
import { requestSync } from "@/src/settings/repo";

export const NPSSO_INVALID = "That doesn't look like a 64-character npsso.";
export const NPSSO_REJECTED = "PSN didn't accept this npsso. Sign in again and copy a fresh one.";
export const NPSSO_SAVED = "Token saved. A sync has started.";

export type FormResult = { ok: boolean; message: string };

/** Validates and stores an npsso, then asks the worker for a sync. Never returns the token. */
export async function saveNpssoToken(
  db: Db,
  gw: PsnGateway,
  key: Buffer,
  raw: string,
  now: Date,
): Promise<FormResult> {
  const npsso = raw.trim();
  if (!NPSSO_PATTERN.test(npsso)) return { ok: false, message: NPSSO_INVALID };
  if ((await connectWithNpsso(db, gw, key, npsso, now)) === "invalid") {
    return { ok: false, message: NPSSO_REJECTED };
  }
  await requestSync(db, now);
  return { ok: true, message: NPSSO_SAVED };
}
