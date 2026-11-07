import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { sessions } from "@/src/db/schema";

const REFRESH_AFTER_MS = 60 * 60_000;

export async function createSession(db: Db, now: Date): Promise<string> {
  const id = randomBytes(32).toString("base64url");
  await db.insert(sessions).values({ id, createdAt: now, lastSeenAt: now });
  return id;
}

export async function validateSession(db: Db, id: string, now: Date): Promise<boolean> {
  const [row] = await db.select().from(sessions).where(eq(sessions.id, id));
  if (!row) return false;
  if (now.getTime() - row.lastSeenAt.getTime() > REFRESH_AFTER_MS) {
    await db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, id));
  }
  return true;
}

export async function deleteAllSessions(db: Db): Promise<void> {
  await db.delete(sessions);
}
