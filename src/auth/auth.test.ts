import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/src/db/client";
import { sessions } from "@/src/db/schema";
import { createTestDb } from "@/tests/helpers/db";
import { verifyLogin } from "@/src/auth/password";
import { createLoginLimiter } from "@/src/auth/rate-limit";
import { SESSION_MAX_AGE_S } from "@/src/auth/cookie";
import { createSession, deleteAllSessions, hashSessionId, validateSession } from "@/src/auth/sessions";

const NOW = new Date("2026-11-07T10:00:00Z");

describe("sessions", () => {
  let db: Db;
  beforeEach(async () => {
    db = await createTestDb();
  });

  it("validates a freshly created session", async () => {
    const id = await createSession(db, NOW);
    expect(id).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await validateSession(db, id, NOW)).toBe(true);
  });

  it("rejects an unknown session id", async () => {
    expect(await validateSession(db, "nope", NOW)).toBe(false);
  });

  it("rejects sessions after deleteAllSessions", async () => {
    const id = await createSession(db, NOW);
    await deleteAllSessions(db);
    expect(await validateSession(db, id, NOW)).toBe(false);
  });

  it("refreshes lastSeenAt only when older than one hour", async () => {
    const id = await createSession(db, NOW);
    const lastSeen = async () =>
      (await db.select().from(sessions).where(eq(sessions.id, hashSessionId(id))))[0].lastSeenAt;

    const soon = new Date(NOW.getTime() + 59 * 60_000);
    await validateSession(db, id, soon);
    expect((await lastSeen()).getTime()).toBe(NOW.getTime());

    const later = new Date(NOW.getTime() + 61 * 60_000);
    await validateSession(db, id, later);
    expect((await lastSeen()).getTime()).toBe(later.getTime());
  });

  it("stores only the hash of the session id", async () => {
    const id = await createSession(db, NOW);
    const rows = await db.select().from(sessions);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(hashSessionId(id));
    expect(rows[0].id).not.toBe(id);
    expect(hashSessionId(id)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects and deletes a session not seen for more than 400 days", async () => {
    const id = await createSession(db, NOW);
    const limit = SESSION_MAX_AGE_S * 1000;
    expect(await validateSession(db, id, new Date(NOW.getTime() + limit))).toBe(true);
    const other = await createSession(db, NOW);
    expect(await validateSession(db, other, new Date(NOW.getTime() + limit + 1))).toBe(false);
    const left = await db.select().from(sessions);
    expect(left.map((r) => r.id)).toEqual([hashSessionId(id)]);
    expect(await validateSession(db, id, new Date(NOW.getTime() + 2 * limit + 1))).toBe(false);
    expect(await db.select().from(sessions)).toHaveLength(0);
  });

  it("createSession sweeps expired sessions", async () => {
    await createSession(db, new Date(NOW.getTime() - 401 * 24 * 60 * 60_000));
    const fresh = await createSession(db, NOW);
    const rows = await db.select().from(sessions);
    expect(rows.map((r) => r.id)).toEqual([hashSessionId(fresh)]);
  });

  it("any cookie value is just an unknown session", async () => {
    for (const value of ["", "x".repeat(5000), "é💥 ;="]) {
      expect(await validateSession(db, value, NOW)).toBe(false);
    }
  });
});

describe("login limiter", () => {
  it("blocks the 6th attempt within the window and allows again after 15 min 1 s", () => {
    const limiter = createLoginLimiter({ max: 5, windowMs: 15 * 60_000 });
    const t = NOW.getTime();
    for (let i = 0; i < 5; i++) {
      expect(limiter.check("1.1.1.1", t)).toBe(true);
      limiter.fail("1.1.1.1", t);
    }
    expect(limiter.check("1.1.1.1", t + 1000)).toBe(false);
    expect(limiter.check("2.2.2.2", t + 1000)).toBe(true);
    expect(limiter.check("1.1.1.1", t + 15 * 60_000 + 1000)).toBe(true);
  });

  it("reset clears the failures", () => {
    const limiter = createLoginLimiter({ max: 5, windowMs: 15 * 60_000 });
    const t = NOW.getTime();
    for (let i = 0; i < 5; i++) limiter.fail("1.1.1.1", t);
    limiter.reset("1.1.1.1");
    expect(limiter.check("1.1.1.1", t)).toBe(true);
  });
});

describe("verifyLogin", () => {
  let cfg: { adminUsername: string; adminPasswordHash: string };
  beforeAll(async () => {
    cfg = { adminUsername: "admin", adminPasswordHash: await bcrypt.hash("secret", 4) };
  });

  it("accepts the right credentials", async () => {
    expect(await verifyLogin("admin", "secret", cfg)).toBe(true);
  });
  it("refuses a wrong username even with the right password", async () => {
    expect(await verifyLogin("root", "secret", cfg)).toBe(false);
  });
  it("refuses a wrong password", async () => {
    expect(await verifyLogin("admin", "nope", cfg)).toBe(false);
  });
});
