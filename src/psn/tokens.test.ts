import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/src/db/client";
import { getSettings, loadPsnTokens, savePsnTokens } from "@/src/settings/repo";
import { connectWithNpsso, getValidAuth, NPSSO_PATTERN } from "@/src/psn/tokens";
import { PsnRefusedError } from "@/src/psn/gateway";
import { createFakePsn } from "@/tests/fakes/psn";
import { createTestDb } from "@/tests/helpers/db";
import type { PsnTokens } from "@/src/psn/types";

const key = randomBytes(32);
const now = new Date("2026-11-07T10:00:00Z");
const minutes = (n: number) => new Date(now.getTime() + n * 60_000);
const stored = (accessMin: number): PsnTokens => ({
  accessToken: "stored-access",
  accessExpiresAt: minutes(accessMin),
  refreshToken: "stored-refresh",
  refreshExpiresAt: minutes(60 * 24 * 60),
});
const renewed: PsnTokens = {
  accessToken: "new-access",
  accessExpiresAt: minutes(60),
  refreshToken: "new-refresh",
  refreshExpiresAt: minutes(60 * 24 * 60),
};

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe("getValidAuth", () => {
  it("returns missing without stored tokens", async () => {
    const gw = createFakePsn({});
    expect(await getValidAuth(db, gw, key, now)).toBe("missing");
  });

  it("returns the stored access token when valid for more than 30 minutes", async () => {
    await savePsnTokens(db, key, stored(31), "n", now);
    const gw = createFakePsn({ tokens: renewed });
    expect(await getValidAuth(db, gw, key, now)).toEqual({ accessToken: "stored-access" });
    expect(gw.calls).toEqual([]);
  });

  it("refreshes and saves new tokens when the access token expires within 30 minutes", async () => {
    await savePsnTokens(db, key, stored(30), "n", now);
    const gw = createFakePsn({ tokens: renewed });
    expect(await getValidAuth(db, gw, key, now)).toEqual({ accessToken: "new-access" });
    expect(gw.calls).toEqual(["refresh:"]);
    const t = await loadPsnTokens(db, key);
    expect(t?.accessToken).toBe("new-access");
    expect(t?.refreshToken).toBe("new-refresh");
    expect(t?.npssoSetAt).toEqual(now);
  });

  it("returns expired and flags the auth status when PSN refuses the refresh", async () => {
    await savePsnTokens(db, key, stored(-1), "n", now);
    const gw = createFakePsn({ failures: [{ method: "refresh", error: new PsnRefusedError() }] });
    expect(await getValidAuth(db, gw, key, now)).toBe("expired");
    expect((await getSettings(db)).psnAuthStatus).toBe("expired");
  });

  it("throws \"Couldn't reach PSN\" and keeps the auth status when PSN is unreachable", async () => {
    for (const error of [new TypeError("fetch failed"), Object.assign(new Error("x"), { cause: { code: "ENOTFOUND" } })]) {
      await savePsnTokens(db, key, stored(-1), "n", now);
      const gw = createFakePsn({ failures: [{ method: "refresh", error }] });
      await expect(getValidAuth(db, gw, key, now)).rejects.toThrow("Couldn't reach PSN");
      expect((await getSettings(db)).psnAuthStatus).toBe("valid");
    }
  });

  it("throws \"PSN token refresh failed (...)\" and keeps the auth status on another error", async () => {
    await savePsnTokens(db, key, stored(-1), "n", now);
    const gw = createFakePsn({ failures: [{ method: "refresh", error: new SyntaxError("Unexpected token <") }] });
    await expect(getValidAuth(db, gw, key, now)).rejects.toThrow(
      new Error("PSN token refresh failed (Unexpected token <)"),
    );
    expect((await getSettings(db)).psnAuthStatus).toBe("valid");
  });

  it("gives up after 20 s when the refresh never answers", async () => {
    await savePsnTokens(db, key, stored(-1), "n", now);
    vi.useFakeTimers();
    try {
      const hang = { ...createFakePsn(), refresh: () => new Promise<never>(() => {}) };
      const p = expect(getValidAuth(db, hang, key, now)).rejects.toThrow("Couldn't reach PSN");
      await vi.advanceTimersByTimeAsync(21_000);
      await p;
    } finally {
      vi.useRealTimers();
    }
    expect((await getSettings(db)).psnAuthStatus).toBe("valid");
  });

  it("propagates a failed save of the refreshed tokens without flagging the auth as expired", async () => {
    await savePsnTokens(db, key, stored(-1), "n", now);
    const gw = createFakePsn({ tokens: renewed });
    // Only the save of the rotated tokens touches the encrypted token columns.
    const failingSave = new Proxy(db, {
      get(target, prop, recv) {
        if (prop !== "update") return Reflect.get(target, prop, recv);
        return (table: never) => {
          const builder = target.update(table);
          return new Proxy(builder, {
            get(b, p, r) {
              if (p !== "set") return Reflect.get(b, p, r);
              return (v: Record<string, unknown>) => {
                if ("accessTokenEnc" in v) throw new Error("db down");
                return b.set(v as never);
              };
            },
          });
        };
      },
    });

    await expect(getValidAuth(failingSave, gw, key, now)).rejects.toThrow("db down");
    expect((await getSettings(db)).psnAuthStatus).toBe("valid");
  });
});

describe("connectWithNpsso", () => {
  const npsso = "a".repeat(64);

  it("matches 64 alphanumeric characters only", () => {
    expect(NPSSO_PATTERN.test(npsso)).toBe(true);
    expect(NPSSO_PATTERN.test("a".repeat(63))).toBe(false);
  });

  it("rejects an invalid npsso without calling the gateway", async () => {
    const gw = createFakePsn({ tokens: renewed });
    expect(await connectWithNpsso(db, gw, key, "a".repeat(63), now)).toBe("invalid");
    expect(gw.calls).toEqual([]);
  });

  it("exchanges the npsso and stores the tokens", async () => {
    const gw = createFakePsn({ tokens: renewed });
    expect(await connectWithNpsso(db, gw, key, npsso, now)).toBe("ok");
    expect(gw.calls).toEqual(["exchangeNpsso:"]);
    const s = await getSettings(db);
    expect(s.npssoSetAt).toEqual(now);
    expect(s.psnAuthStatus).toBe("valid");
    expect((await loadPsnTokens(db, key))?.accessToken).toBe("new-access");
  });

  it("returns invalid when the exchange fails", async () => {
    const gw = createFakePsn({ failures: [{ method: "exchangeNpsso" }] });
    expect(await connectWithNpsso(db, gw, key, npsso, now)).toBe("invalid");
    expect(await loadPsnTokens(db, key)).toBeNull();
  });

  it("connectWithNpsso returns invalid when PSN refuses", async () => {
    const gw = createFakePsn({ failures: [{ method: "exchangeNpsso", error: new PsnRefusedError() }] });
    expect(await connectWithNpsso(db, gw, key, npsso, now)).toBe("invalid");
    expect(await loadPsnTokens(db, key)).toBeNull();
  });

  it("returns unreachable on a network error, a timeout, or a connection-level cause", async () => {
    const failing = (e: unknown) => ({
      ...createFakePsn(),
      exchangeNpsso: async () => {
        throw e;
      },
    });
    expect(await connectWithNpsso(db, failing(new TypeError("fetch failed")), key, npsso, now)).toBe("unreachable");
    expect(await connectWithNpsso(db, failing(new DOMException("slow", "TimeoutError")), key, npsso, now)).toBe("unreachable");
    expect(await connectWithNpsso(db, failing(new DOMException("stop", "AbortError")), key, npsso, now)).toBe("unreachable");
    expect(
      await connectWithNpsso(db, failing(Object.assign(new Error("x"), { cause: { code: "ENOTFOUND" } })), key, npsso, now),
    ).toBe("unreachable");
    expect(await loadPsnTokens(db, key)).toBeNull();
  });

  it("returns unreachable when PSN never answers", async () => {
    vi.useFakeTimers();
    try {
      const hang = { ...createFakePsn(), exchangeNpsso: () => new Promise<never>(() => {}) };
      const p = connectWithNpsso(db, hang, key, npsso, now);
      await vi.advanceTimersByTimeAsync(21_000);
      expect(await p).toBe("unreachable");
    } finally {
      vi.useRealTimers();
    }
  });
});
