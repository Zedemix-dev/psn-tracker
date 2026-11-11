import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/src/db/client";
import { trophies } from "@/src/db/schema";
import { refreshUserState } from "@/src/sync/user-state";
import { syncTitle } from "@/src/sync/title";
import { createFakePsn } from "@/tests/fakes/psn";
import { makeGroup, makeRemoteTitle, makeTrophies, ZERO_COUNTS } from "@/tests/fixtures/titles";
import { createTestDb } from "@/tests/helpers/db";

const auth = { accessToken: "tok" };
const now = new Date("2026-01-01T00:00:00Z");
const ID = "NPWR00001_00";
const ref = { npCommunicationId: ID, npServiceName: "trophy" as const };

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe("refreshUserState", () => {
  it("updates rates and progress without touching earned state", async () => {
    const first = makeTrophies(2, { earnedIds: [1] });
    first.defs[0].progressTarget = 4;
    const gw1 = createFakePsn({
      titleData: { [ID]: { groups: [makeGroup("default")], defs: first.defs, userTrophies: first.userTrophies } },
    });
    await syncTitle(db, gw1, auth, makeRemoteTitle({ earned: { ...ZERO_COUNTS, bronze: 1 } }), now);
    const [earnedBefore] = await db.select().from(trophies).where(eq(trophies.trophyId, 1));

    const next = makeTrophies(2, { earnedIds: [] });
    next.userTrophies[0].progress = 3;
    next.userTrophies[0].progressedAt = new Date("2025-05-06T00:00:00Z");
    next.userTrophies.forEach((u) => {
      u.earnedRate = 5.5;
      u.rareCategory = 1;
    });
    const gw2 = createFakePsn({ titleData: { [ID]: { userTrophies: next.userTrophies } } });

    const count = await refreshUserState(db, gw2, auth, ref);

    expect(count).toBe(2);
    const rows = await db.select().from(trophies).where(eq(trophies.titleId, ID)).orderBy(trophies.trophyId);
    expect(rows[0]).toMatchObject({
      progress: 3,
      progressedAt: new Date("2025-05-06T00:00:00Z"),
      earnedRate: "5.50",
      rareCategory: 1,
      earned: false,
      earnedAt: null,
    });
    expect(rows[1]).toMatchObject({ earnedRate: "5.50", earned: true, earnedAt: earnedBefore.earnedAt });
  });

  it("keeps a known rare category when PSN sends none, and lets a real 0 replace it", async () => {
    const first = makeTrophies(1);
    await syncTitle(
      db,
      createFakePsn({ titleData: { [ID]: { groups: [makeGroup("default")], ...first } } }),
      auth,
      makeRemoteTitle({ defined: { ...ZERO_COUNTS, bronze: 1 } }),
      now,
    );
    const read = async () => (await db.select().from(trophies).where(eq(trophies.trophyId, 0)))[0].rareCategory;
    expect(await read()).toBe(2);

    const empty = makeTrophies(1);
    empty.userTrophies[0].rareCategory = null;
    await refreshUserState(db, createFakePsn({ titleData: { [ID]: { userTrophies: empty.userTrophies } } }), auth, ref);
    expect(await read()).toBe(2);

    const zero = makeTrophies(1);
    zero.userTrophies[0].rareCategory = 0;
    await refreshUserState(db, createFakePsn({ titleData: { [ID]: { userTrophies: zero.userTrophies } } }), auth, ref);
    expect(await read()).toBe(0);
  });
});
