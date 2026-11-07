import { describe, expect, it, vi } from "vitest";
import { loginAttempt } from "@/src/auth/login";
import { createLoginLimiter } from "@/src/auth/rate-limit";

const T = new Date("2026-11-07T10:00:00Z").getTime();
const make = () => createLoginLimiter({ max: 5, windowMs: 15 * 60_000 });

describe("loginAttempt", () => {
  it("lets at most 5 of 10 parallel wrong-password attempts reach verify", async () => {
    const limiter = make();
    const verify = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return false;
    });
    const results = await Promise.all(
      Array.from({ length: 10 }, () => loginAttempt({ ip: "1.1.1.1", now: T, limiter, verify })),
    );
    expect(verify).toHaveBeenCalledTimes(5);
    expect(results.filter((r) => r === "invalid")).toHaveLength(5);
    expect(results.filter((r) => r === "blocked")).toHaveLength(5);
  });

  it("blocks the 6th sequential attempt, then allows again after 15 min 1 s", async () => {
    const limiter = make();
    const verify = async () => false;
    for (let i = 0; i < 5; i++) {
      expect(await loginAttempt({ ip: "a", now: T, limiter, verify })).toBe("invalid");
    }
    expect(await loginAttempt({ ip: "a", now: T + 1000, limiter, verify })).toBe("blocked");
    expect(await loginAttempt({ ip: "a", now: T + 15 * 60_000 + 1000, limiter, verify })).toBe(
      "invalid",
    );
  });

  it("resets the counter on success", async () => {
    const limiter = make();
    for (let i = 0; i < 4; i++) {
      await loginAttempt({ ip: "a", now: T, limiter, verify: async () => false });
    }
    expect(await loginAttempt({ ip: "a", now: T, limiter, verify: async () => true })).toBe("ok");
    for (let i = 0; i < 5; i++) {
      expect(await loginAttempt({ ip: "a", now: T, limiter, verify: async () => false })).toBe(
        "invalid",
      );
    }
  });
});
