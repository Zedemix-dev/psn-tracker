import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/src/db/client";
import { titles } from "@/src/db/schema";
import { syncCatalog } from "@/src/sync/catalog";
import { upsertTitleRow } from "@/src/sync/title";
import { createFakePsn } from "@/tests/fakes/psn";
import { makeRemoteTitle } from "@/tests/fixtures/titles";
import { createTestDb } from "@/tests/helpers/db";

const auth = { accessToken: "tok" };
const now = new Date("2026-01-01T00:00:00Z");
const catalog = { publisher: "Sony", releaseDate: new Date("2020-11-12T00:00:00Z"), genres: ["Action", "RPG"] };

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

async function seed(ids: string[], conceptId: number | null) {
  for (const id of ids) {
    await upsertTitleRow(db, makeRemoteTitle({ npCommunicationId: id }), now);
    await db.update(titles).set({ conceptId }).where(eq(titles.npCommunicationId, id));
  }
}
const rows = () => db.select().from(titles).orderBy(titles.npCommunicationId);

describe("syncCatalog", () => {
  it("fetches each concept once and fills every title sharing it", async () => {
    await seed(["NPWR00001_00", "NPWR00002_00"], 1);
    const gw = createFakePsn({ catalogs: { 1: catalog } });

    const res = await syncCatalog(db, gw, auth, "missing", now);

    expect(res).toEqual({ fetched: 1, failed: 0 });
    expect(gw.calls.filter((c) => c === "getCatalog:1")).toHaveLength(1);
    for (const t of await rows()) {
      expect(t.publisher).toBe("Sony");
      expect(t.genres).toEqual(["Action", "RPG"]);
      expect(t.releaseDate).toEqual(catalog.releaseDate);
      expect(t.catalogCheckedAt).toEqual(now);
    }
  });

  it("only fetches missing concepts unless asked for all", async () => {
    await seed(["NPWR00001_00"], 1);
    const gw = createFakePsn({ catalogs: { 1: catalog } });

    await syncCatalog(db, gw, auth, "missing", now);
    await syncCatalog(db, gw, auth, "missing", now);
    expect(gw.calls.filter((c) => c === "getCatalog:1")).toHaveLength(1);

    await syncCatalog(db, gw, auth, "all", now);
    expect(gw.calls.filter((c) => c === "getCatalog:1")).toHaveLength(2);
  });

  it("counts a failing concept and retries it next time", async () => {
    await seed(["NPWR00001_00"], 2);
    const gw = createFakePsn({ catalogs: {} });

    expect(await syncCatalog(db, gw, auth, "missing", now)).toEqual({ fetched: 0, failed: 1 });
    expect((await rows())[0].catalogCheckedAt).toBeNull();
  });
});
