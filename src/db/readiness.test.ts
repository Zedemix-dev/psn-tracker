import { sql } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { createTestDb } from "@/tests/helpers/db";
import journal from "@/src/db/migrations/meta/_journal.json";
import { EXPECTED_MIGRATIONS, isDbReady } from "@/src/db/readiness";

describe("isDbReady", () => {
  it("knows the journal size", () => {
    expect(EXPECTED_MIGRATIONS).toBe(journal.entries.length);
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

  it("does not memoize a not-ready answer", async () => {
    const db = await createTestDb();
    const res = (await db.execute(
      sql`delete from drizzle."__drizzle_migrations" where id = (select max(id) from drizzle."__drizzle_migrations") returning hash, created_at`,
    )) as unknown as { rows: Array<{ hash: string; created_at: string }> };
    const row = res.rows[0];
    expect(await isDbReady(db)).toBe(false);
    await db.execute(
      sql`insert into drizzle."__drizzle_migrations" ("hash", "created_at") values (${row.hash}, ${row.created_at})`,
    );
    expect(await isDbReady(db)).toBe(true);
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
