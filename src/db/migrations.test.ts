import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { hashSessionId, validateSession } from "@/src/auth/sessions";
import { sessions } from "@/src/db/schema";
import { createTestDb } from "@/tests/helpers/db";

const NOW = new Date("2026-11-07T10:00:00Z");

describe("migration 0009_hash_session_ids", () => {
  it("converts a session id stored before 0009 into its hash", async () => {
    const db = await createTestDb();
    await db.insert(sessions).values({ id: "pre-0009-session", createdAt: NOW, lastSeenAt: NOW });
    const file = join(process.cwd(), "src/db/migrations/0009_hash_session_ids.sql");
    await db.execute(sql.raw(readFileSync(file, "utf8")));

    expect(await validateSession(db, "pre-0009-session", NOW)).toBe(true);
    const rows = await db.select().from(sessions);
    expect(rows.map((r) => r.id)).toEqual([hashSessionId("pre-0009-session")]);
  });
});
