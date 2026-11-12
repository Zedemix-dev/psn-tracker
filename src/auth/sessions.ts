import { createHash, randomBytes } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { SESSION_MAX_AGE_S } from "@/src/auth/cookie";
import type { Db } from "@/src/db/client";
import { sessions } from "@/src/db/schema";

const REFRESH_AFTER_MS = 60 * 60_000;

const MAX_AGE_MS = SESSION_MAX_AGE_S * 1000;

/** The database keeps only this hash: a leaked table cannot be replayed as cookies. */
export function hashSessionId(id: string): string {
  return createHash("sha256").update(id, "utf8").digest("hex");
}

export async function createSession(db: Db, now: Date): Promise<string> {
  const id = randomBytes(32).toString("base64url");
  await db.delete(sessions).where(lt(sessions.lastSeenAt, new Date(now.getTime() - MAX_AGE_MS)));
  await db.insert(sessions).values({ id: hashSessionId(id), createdAt: now, lastSeenAt: now });
  return id;
}

export async function validateSession(db: Db, id: string, now: Date): Promise<boolean> {
  const hash = hashSessionId(id);
  const [row] = await db.select().from(sessions).where(eq(sessions.id, hash));
  if (!row) return false;
  if (now.getTime() - row.lastSeenAt.getTime() > MAX_AGE_MS) {
    await db.delete(sessions).where(eq(sessions.id, hash));
    return false;
  }
  if (now.getTime() - row.lastSeenAt.getTime() > REFRESH_AFTER_MS) {
    await db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, hash));
  }
  return true;
}

export async function deleteAllSessions(db: Db): Promise<void> {
  await db.delete(sessions);
}
