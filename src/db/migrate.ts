import { readMigrationFiles } from "drizzle-orm/migrator";
import type { PgDialect, PgSession } from "drizzle-orm/pg-core";
import type { Db } from "@/src/db/client";

// Driver-agnostic: both the pglite and postgres-js migrators are thin wrappers
// around dialect.migrate, so we call it directly to work with either driver.
export async function runMigrations(
  db: Db,
  migrationsFolder = process.env.MIGRATIONS_DIR ?? "src/db/migrations",
): Promise<void> {
  const internals = db as unknown as { dialect: PgDialect; session: PgSession };
  await internals.dialect.migrate(readMigrationFiles({ migrationsFolder }), internals.session, {
    migrationsFolder,
  });
}
