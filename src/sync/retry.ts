import type { PsnGateway } from "@/src/psn/gateway";

export type Sleep = (ms: number) => Promise<void>;

export const defaultSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const PACE_MS = 200;
const RETRY_DELAYS_MS = [1000, 2000, 4000];

const RETRY_PHRASES = [
  "too many requests",
  "rate limit",
  "internal server error",
  "bad gateway",
  "service unavailable",
  "gateway timeout",
];
const NETWORK_CODES = ["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN"];

/**
 * Best-effort: psn-api hides the HTTP status (the real gateway throws a plain
 * Error(message)), so besides a numeric status we recognise network errors and
 * explicit phrases. Bare numbers in a message are never trusted.
 */
export function isRetryable(err: unknown): boolean {
  const e = err as { status?: unknown; statusCode?: unknown; code?: unknown; cause?: { code?: unknown } } | null;
  const status = [e?.status, e?.statusCode].find((x) => typeof x === "number");
  if (typeof status === "number") return status === 429 || (status >= 500 && status <= 599);
  const message = err instanceof Error ? err.message : String(err);
  if (err instanceof TypeError && message === "fetch failed") return true;
  for (const code of [e?.code, e?.cause?.code]) {
    if (typeof code === "string" && (NETWORK_CODES.includes(code) || code.startsWith("UND_ERR_"))) return true;
  }
  const lower = message.toLowerCase();
  return RETRY_PHRASES.some((p) => lower.includes(p));
}

/**
 * Wraps a gateway: 200 ms between two PSN calls, and up to 3 retries
 * (1, 2 then 4 s) on HTTP 429 / 5xx. Other errors propagate immediately.
 */
export function withPacing(gw: PsnGateway, sleep: Sleep = defaultSleep): PsnGateway {
  let first = true;
  const wrapped = {} as Record<string, unknown>;
  for (const key of Object.keys(gw) as (keyof PsnGateway)[]) {
    wrapped[key] = async (...args: unknown[]) => {
      for (let attempt = 0; ; attempt++) {
        if (!first) await sleep(PACE_MS);
        first = false;
        try {
          return await (gw[key] as (...a: unknown[]) => Promise<unknown>)(...args);
        } catch (err) {
          if (attempt >= RETRY_DELAYS_MS.length || !isRetryable(err)) throw err;
          await sleep(RETRY_DELAYS_MS[attempt]);
        }
      }
    };
  }
  return wrapped as unknown as PsnGateway;
}
