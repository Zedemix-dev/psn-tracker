export type LoginLimiter = {
  check(ip: string, now: number): boolean;
  fail(ip: string, now: number): void;
  reset(ip: string): void;
};

export function createLoginLimiter(opts: { max: number; windowMs: number }): LoginLimiter {
  const failures = new Map<string, number[]>();
  const recent = (ip: string, now: number) => {
    const list = (failures.get(ip) ?? []).filter((t) => now - t <= opts.windowMs);
    if (list.length > 0) failures.set(ip, list);
    else failures.delete(ip);
    return list;
  };
  return {
    check: (ip, now) => recent(ip, now).length < opts.max,
    fail(ip, now) {
      failures.set(ip, [...recent(ip, now), now]);
    },
    reset(ip) {
      failures.delete(ip);
    },
  };
}
