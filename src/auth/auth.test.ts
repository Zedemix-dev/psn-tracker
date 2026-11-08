import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/src/db/client";
import { sessions } from "@/src/db/schema";
import { createTestDb } from "@/tests/helpers/db";
import { verifyLogin } from "@/src/auth/password";
import { createLoginLimiter } from "@/src/auth/rate-limit";
import { createSession, deleteAllSessions, validateSession } from "@/src/auth/sessions";

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
      (await db.select().from(sessions).where(eq(sessions.id, id)))[0].lastSeenAt;

    const soon = new Date(NOW.getTime() + 59 * 60_000);
    await validateSession(db, id, soon);
    expect((await lastSeen()).getTime()).toBe(NOW.getTime());

    const later = new Date(NOW.getTime() + 61 * 60_000);
    await validateSession(db, id, later);
    expect((await lastSeen()).getTime()).toBe(later.getTime());
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
