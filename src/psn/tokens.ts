import type { Db } from "@/src/db/client";
import { loadPsnTokens, savePsnTokens, setPsnAuthStatus } from "@/src/settings/repo";
import type { PsnGateway } from "@/src/psn/gateway";

export const NPSSO_PATTERN = /^[A-Za-z0-9]{64}$/;
const REFRESH_MARGIN_MS = 5 * 60_000;

export async function getValidAuth(
  db: Db,
  gw: PsnGateway,
  key: Buffer,
  now: Date,
): Promise<{ accessToken: string } | "expired" | "missing"> {
  const stored = await loadPsnTokens(db, key);
  if (!stored) return "missing";
  if (stored.accessExpiresAt.getTime() - now.getTime() > REFRESH_MARGIN_MS) {
    return { accessToken: stored.accessToken };
  }
  try {
    const fresh = await gw.refresh(stored.refreshToken);
    await savePsnTokens(db, key, fresh);
    return { accessToken: fresh.accessToken };
  } catch {
    await setPsnAuthStatus(db, "expired");
    return "expired";
  }
}

export async function connectWithNpsso(
  db: Db,
  gw: PsnGateway,
  key: Buffer,
  npsso: string,
  now: Date,
): Promise<"ok" | "invalid"> {
  if (!NPSSO_PATTERN.test(npsso)) return "invalid";
  let tokens;
  try {
    tokens = await gw.exchangeNpsso(npsso);
  } catch {
    return "invalid";
  }
  await savePsnTokens(db, key, tokens, npsso, now);
  return "ok";
}
