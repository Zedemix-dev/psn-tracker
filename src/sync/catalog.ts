import { eq, isNotNull } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { titles } from "@/src/db/schema";
import type { PsnAuth, PsnGateway } from "@/src/psn/gateway";

/**
 * Fills publisher, genres and release date of every title from its PSN game concept.
 * One call per concept (PS4 and PS5 versions share one). `"missing"` skips concepts whose
 * titles were all checked already; `"all"` refreshes every concept. A failing concept is
 * counted, left unchecked and retried by the next run.
 */
export async function syncCatalog(
  db: Db,
  gw: PsnGateway,
  auth: PsnAuth,
  mode: "missing" | "all",
  now: Date,
): Promise<{ fetched: number; failed: number }> {
  const rows = await db
    .select({ conceptId: titles.conceptId, checkedAt: titles.catalogCheckedAt })
    .from(titles)
    .where(isNotNull(titles.conceptId));
  const concepts = new Set<number>();
  for (const r of rows) {
    if (mode === "all" || r.checkedAt === null) concepts.add(r.conceptId!);
  }

  let fetched = 0;
  let failed = 0;
  for (const conceptId of concepts) {
    try {
      const c = await gw.getCatalog(auth, conceptId);
      await db
        .update(titles)
        .set({
          publisher: c.publisher,
          genres: c.genres,
          releaseDate: c.releaseDate,
          catalogCheckedAt: now,
        })
        .where(eq(titles.conceptId, conceptId));
      fetched++;
    } catch {
      failed++;
    }
  }
  return { fetched, failed };
}
