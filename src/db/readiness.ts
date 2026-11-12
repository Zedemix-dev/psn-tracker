import { sql } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import journal from "@/src/db/migrations/meta/_journal.json";

// Frozen at build time: how many migrations this build of the app knows.
export const EXPECTED_MIGRATIONS: number = journal.entries.length;

// Distinct error messages already logged: a bad DATABASE_URL must show up once in the app log, not per request.
const logged = new Set<string>();
export function logOnce(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  if (logged.has(message)) return;
  logged.add(message);
  console.error(`[db] not ready: ${message}`);
}

// Once true, a Db stays ready: no more queries. Keyed by Db (PGlite tests).
const ready = new WeakMap<Db, true>();

export async function isDbReady(db: Db): Promise<boolean> {
  if (ready.has(db)) return true;
  try {
    const result: unknown = await db.execute(
      sql`select count(*)::int as n from drizzle."__drizzle_migrations"`,
    );
    // pglite returns { rows }, postgres-js returns the rows array itself.
    const rows = (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as Array<{ n: number }>;
    if (Number(rows[0]?.n ?? 0) >= EXPECTED_MIGRATIONS) {
      ready.set(db, true);
      return true;
    }
  } catch (error) {
    // Missing table or unreachable database: not ready yet (logged once per distinct message).
    logOnce(error);
  }
  return false;
}
