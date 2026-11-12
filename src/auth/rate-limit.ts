export type LoginLimiter = {
  check(ip: string, now: number): boolean;
  fail(ip: string, now: number): void;
  /** Atomically checks the cap and records the attempt (synchronous, so no race). */
  attempt(ip: string, now: number): boolean;
  reset(ip: string): void;
  /** Number of addresses currently tracked. */
  size(): number;
};

export function createLoginLimiter(opts: { max: number; windowMs: number }): LoginLimiter {
  const failures = new Map<string, number[]>();
  const recent = (ip: string, now: number) => {
    const list = (failures.get(ip) ?? []).filter((t) => now - t <= opts.windowMs);
    if (list.length > 0) failures.set(ip, list);
    else failures.delete(ip);
    return list;
  };
  /** Drops every address whose latest attempt is older than the window. */
  const forgetStale = (now: number) => {
    for (const [ip, list] of failures) {
      if (now - list[list.length - 1] > opts.windowMs) failures.delete(ip);
    }
  };
  return {
    check: (ip, now) => recent(ip, now).length < opts.max,
    fail(ip, now) {
      forgetStale(now);
      failures.set(ip, [...recent(ip, now), now]);
    },
    attempt(ip, now) {
      forgetStale(now);
      const list = recent(ip, now);
      if (list.length >= opts.max) return false;
      failures.set(ip, [...list, now]);
      return true;
    },
    reset(ip) {
      failures.delete(ip);
    },
    size: () => failures.size,
  };
}
