import { count, max } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { syncRuns } from "@/src/db/schema";

type Entry = { marker: string; value: Promise<unknown> };

// Keyed by Db instance, or PGlite tests would contaminate each other.
const caches = new WeakMap<Db, Map<string, Entry>>();

/**
 * The site and the worker share only Postgres, so the "has a run ended since?" marker is read from
 * the database on every call (one cheap query): the latest finished_at over all runs, plus the row count.
 */
async function readMarker(db: Db): Promise<string> {
  const [row] = await db.select({ last: max(syncRuns.finishedAt), n: count() }).from(syncRuns);
  return `${row?.last ? new Date(row.last).getTime() : "none"}:${row?.n ?? 0}`;
}

/** Keeps `load`'s value per Db and key until a sync run starts or ends. A failed load is not kept. */
export async function cachedUntilNextRun<T>(db: Db, key: string, load: () => Promise<T>): Promise<T> {
  const marker = await readMarker(db);
  let entries = caches.get(db);
  if (!entries) caches.set(db, (entries = new Map()));
  const hit = entries.get(key);
  if (hit && hit.marker === marker) return hit.value as Promise<T>;

  const value = load();
  const entry: Entry = { marker, value };
  entries.set(key, entry);
  value.catch(() => {
    if (entries.get(key) === entry) entries.delete(key);
  });
  return value;
}
