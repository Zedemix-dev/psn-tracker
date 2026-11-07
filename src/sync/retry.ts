import type { PsnGateway } from "@/src/psn/gateway";

export type Sleep = (ms: number) => Promise<void>;

export const defaultSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const PACE_MS = 200;
const RETRY_DELAYS_MS = [1000, 2000, 4000];

/** True for HTTP 429 and 5xx, read from the error's status or else its message. */
export function isRetryable(err: unknown): boolean {
  const e = err as { status?: unknown; statusCode?: unknown; response?: { status?: unknown } } | null;
  const status = [e?.status, e?.statusCode, e?.response?.status].find((s) => typeof s === "number");
  if (typeof status === "number") return status === 429 || (status >= 500 && status <= 599);
  const message = err instanceof Error ? err.message : String(err);
  return /\b(429|5\d\d)\b|too many requests/i.test(message);
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
