import type { LoginLimiter } from "@/src/auth/rate-limit";

export type LoginOutcome = "ok" | "blocked" | "invalid";

/**
 * The attempt is recorded before the (slow) verification, so concurrent requests
 * cannot all slip under the cap. A successful login clears the counter.
 */
export async function loginAttempt(args: {
  ip: string;
  now: number;
  limiter: LoginLimiter;
  verify: () => Promise<boolean>;
}): Promise<LoginOutcome> {
  const { ip, now, limiter, verify } = args;
  if (!limiter.attempt(ip, now)) return "blocked";
  if (!(await verify())) return "invalid";
  limiter.reset(ip);
  return "ok";
}
