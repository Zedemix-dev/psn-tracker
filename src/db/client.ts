import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getConfig } from "@/src/lib/config";
import * as schema from "@/src/db/schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const PGLITE_PREFIX = "pglite:";

export async function createDb(url: string): Promise<Db> {
  if (url.startsWith(PGLITE_PREFIX)) {
    const target = url.slice(PGLITE_PREFIX.length);
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const client = target === "memory" ? new PGlite() : new PGlite(target);
    return drizzle(client, { schema });
  }
  return drizzlePostgres(postgres(url), { schema });
}

let singleton: Promise<Db> | undefined;

export function getDb(): Promise<Db> {
  singleton ??= createDb(getConfig().databaseUrl);
  return singleton;
}
