import { count, eq, max } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { syncRuns, unobtainableList } from "@/src/db/schema";

type Entry = { marker: string; validity: string; value: Promise<unknown> };

// Keyed by Db instance, or PGlite tests would contaminate each other.
const caches = new WeakMap<Db, Map<string, Entry>>();

/**
 * The site and the worker share only Postgres, so the "has a run ended since?" marker is read from
 * the database on every call (two small queries): the latest finished_at over all runs, plus the row count, plus when the unobtainable list was last applied.
 */
async function readMarker(db: Db): Promise<string> {
  const [row] = await db.select({ last: max(syncRuns.finishedAt), n: count() }).from(syncRuns);
  const [list] = await db.select({ at: unobtainableList.appliedAt }).from(unobtainableList).where(eq(unobtainableList.id, 1));
  return `${row?.last ? new Date(row.last).getTime() : "none"}:${row?.n ?? 0}:${list?.at ? new Date(list.at).getTime() : "none"}`;
}

/**
 * Keeps `load`'s value per Db and key until a sync run starts or ends, or `validity` changes (for a value that also
 * depends on something else, such as the Paris day). The entry is replaced under the same key, never added.
 * A failed load is not kept.
 */
export async function cachedUntilNextRun<T>(db: Db, key: string, load: () => Promise<T>, validity = ""): Promise<T> {
  const marker = await readMarker(db);
  let entries = caches.get(db);
  if (!entries) caches.set(db, (entries = new Map()));
  const hit = entries.get(key);
  if (hit && hit.marker === marker && hit.validity === validity) return hit.value as Promise<T>;

  const value = load();
  const entry: Entry = { marker, validity, value };
  entries.set(key, entry);
  value.catch(() => {
    if (entries.get(key) === entry) entries.delete(key);
  });
  return value;
}
