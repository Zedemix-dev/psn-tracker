import { sql } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { createTestDb } from "@/tests/helpers/db";
import { EXPECTED_MIGRATIONS, isDbReady } from "@/src/db/readiness";

describe("isDbReady", () => {
  it("knows the journal size", () => {
    expect(EXPECTED_MIGRATIONS).toBeGreaterThanOrEqual(9);
  });

  it("is true on a migrated database", async () => {
    expect(await isDbReady(await createTestDb())).toBe(true);
  });

  it("is false when a migration row is missing", async () => {
    const db = await createTestDb();
    await db.execute(
      sql`delete from drizzle."__drizzle_migrations" where id = (select max(id) from drizzle."__drizzle_migrations")`,
    );
    expect(await isDbReady(db)).toBe(false);
  });

  it("is false, without throwing, when the table is absent", async () => {
    const db = await createTestDb();
    await db.execute(sql`drop table drizzle."__drizzle_migrations"`);
    expect(await isDbReady(db)).toBe(false);
  });

  it("stops querying once ready", async () => {
    const db = await createTestDb();
    expect(await isDbReady(db)).toBe(true);
    const spy = vi.spyOn(db, "execute");
    expect(await isDbReady(db)).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });
});
