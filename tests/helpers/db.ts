import { createDb, type Db } from "@/src/db/client";
import { runMigrations } from "@/src/db/migrate";

export async function createTestDb(): Promise<Db> {
  const db = await createDb("pglite:memory");
  await runMigrations(db);
  return db;
}
