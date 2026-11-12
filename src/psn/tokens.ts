import type { Db } from "@/src/db/client";
import { loadPsnTokens, savePsnTokens, setPsnAuthStatus } from "@/src/settings/repo";
import { PsnRefusedError, type PsnGateway } from "@/src/psn/gateway";

export const NPSSO_PATTERN = /^[A-Za-z0-9]{64}$/;
// Longer than a sync (~15 min at most), so the token never expires mid-run.
const REFRESH_MARGIN_MS = 30 * 60_000;
const PSN_TIMEOUT_MS = 20_000;

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
  let fresh;
  try {
    fresh = await withTimeout(gw.refresh(stored.refreshToken), PSN_TIMEOUT_MS);
  } catch (e) {
    if (e instanceof PsnRefusedError) {
      await setPsnAuthStatus(db, "expired");
      return "expired";
    }
    // Neither a refusal nor proof the token is bad: leave the status alone.
    if (isUnreachable(e)) throw new Error("Couldn't reach PSN");
    throw new Error(`PSN token refresh failed (${e instanceof Error ? e.message : String(e)})`);
  }
  // A DB error here is not an auth problem: it propagates as is.
  await savePsnTokens(db, key, fresh);
  return { accessToken: fresh.accessToken };
}

const NETWORK_CODES = new Set(["ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT"]);

/** True when the call never got an answer from PSN (network down, DNS, timeout), as opposed to PSN refusing. */
export function isUnreachable(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  if (e.name === "AbortError" || e.name === "TimeoutError") return true;
  // fetch() rejects with a TypeError ("fetch failed") when it cannot reach the server.
  if (e instanceof TypeError) return true;
  const code = (e.cause as { code?: unknown } | undefined)?.code;
  return typeof code === "string" && NETWORK_CODES.has(code);
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DOMException("PSN did not answer in time", "TimeoutError")), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

export async function connectWithNpsso(
  db: Db,
  gw: PsnGateway,
  key: Buffer,
  npsso: string,
  now: Date,
): Promise<"ok" | "invalid" | "unreachable"> {
  if (!NPSSO_PATTERN.test(npsso)) return "invalid";
  let tokens;
  try {
    tokens = await withTimeout(gw.exchangeNpsso(npsso), PSN_TIMEOUT_MS);
  } catch (e) {
    return isUnreachable(e) ? "unreachable" : "invalid";
  }
  await savePsnTokens(db, key, tokens, npsso, now);
  return "ok";
}
