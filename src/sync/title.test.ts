import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/src/db/client";
import { titles, trophies, trophyGroups } from "@/src/db/schema";
import { loadTitleState, titleNeedsReload } from "@/src/sync/diff";
import { syncTitle, upsertTitleRow } from "@/src/sync/title";
import { createFakePsn } from "@/tests/fakes/psn";
import { makeGroup, makeRemoteTitle, makeTrophies } from "@/tests/fixtures/titles";
import { createTestDb } from "@/tests/helpers/db";

const auth = { accessToken: "tok" };
const now = new Date("2026-01-01T00:00:00Z");
const ID = "NPWR00001_00";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe("syncTitle", () => {
  it("loads every page of a 300-trophy title", async () => {
    const { defs, userTrophies } = makeTrophies(300, { earnedIds: [0, 5] });
    const gw = createFakePsn({
      pageSize: 100,
      titleData: { [ID]: { groups: [makeGroup("default")], defs, userTrophies } },
    });
    const remote = makeRemoteTitle({ defined: { platinum: 0, gold: 0, silver: 0, bronze: 300 } });

    const res = await syncTitle(db, gw, auth, remote, now);

    const rows = await db.select().from(trophies).where(eq(trophies.titleId, ID));
    expect(rows).toHaveLength(300);
    expect(res.trophiesUpdated).toBe(300);
    expect(gw.calls.filter((c) => c === `getTrophyDefs:${ID}`)).toHaveLength(3);
    expect(gw.calls.filter((c) => c === `getUserTrophies:${ID}`)).toHaveLength(3);
  });

  it("stores a new DLC group with zero earned", async () => {
    const base = makeTrophies(2, { earnedIds: [0, 1] });
    const dlc = makeTrophies(2, { groupId: "001", start: 2 });
    const gw = createFakePsn({
      titleData: {
        [ID]: {
          groups: [makeGroup("default"), makeGroup("001")],
          defs: [...base.defs, ...dlc.defs],
          userTrophies: [...base.userTrophies, ...dlc.userTrophies],
        },
      },
    });

    await syncTitle(db, gw, auth, makeRemoteTitle({ hasTrophyGroups: true }), now);

    expect(await db.select().from(trophyGroups).where(eq(trophyGroups.titleId, ID))).toHaveLength(2);
    const dlcRows = await db.select().from(trophies).where(eq(trophies.groupId, "001"));
    expect(dlcRows).toHaveLength(2);
    expect(dlcRows.every((r) => r.earned === false)).toBe(true);
  });

  it("sets title timestamps from stored trophies and stores rates with 2 decimals", async () => {
    const { defs, userTrophies } = makeTrophies(3, { earnedIds: [1, 2] });
    const gw = createFakePsn({ titleData: { [ID]: { groups: [makeGroup("default")], defs, userTrophies } } });
    await syncTitle(db, gw, auth, makeRemoteTitle({ lastUpdatedAt: new Date("2030-01-01T00:00:00Z") }), now);

    const [t] = await db.select().from(titles).where(eq(titles.npCommunicationId, ID));
    expect(t.syncedAt).toEqual(now);
    expect(t.groupsCheckedAt).toEqual(now);
    expect(t.firstTrophyAt).toEqual(new Date(Date.UTC(2024, 0, 2)));
    expect(t.lastTrophyAt).toEqual(new Date(Date.UTC(2024, 0, 3)));
    const [tr] = await db.select().from(trophies).where(eq(trophies.trophyId, 1));
    expect(tr.earnedRate).toBe("12.35");
  });

  it("records a trophy missing from the user state as not earned with null rarity", async () => {
    const { defs, userTrophies } = makeTrophies(2);
    const gw = createFakePsn({
      titleData: { [ID]: { groups: [makeGroup("default")], defs, userTrophies: userTrophies.slice(0, 1) } },
    });
    await syncTitle(db, gw, auth, makeRemoteTitle(), now);
    const [row] = await db.select().from(trophies).where(eq(trophies.trophyId, 1));
    expect(row.earned).toBe(false);
    expect(row.earnedRate).toBeNull();
    expect(row.rareCategory).toBeNull();
    const [t] = await db.select().from(titles);
    expect(t.firstTrophyAt).toBeNull();
    expect(t.lastTrophyAt).toBeNull();
  });

  it("removes groups and trophies no longer present remotely, and is idempotent", async () => {
    const base = makeTrophies(2);
    const dlc = makeTrophies(2, { groupId: "001", start: 2 });
    const full = {
      groups: [makeGroup("default"), makeGroup("001")],
      defs: [...base.defs, ...dlc.defs],
      userTrophies: [...base.userTrophies, ...dlc.userTrophies],
    };
    await syncTitle(db, createFakePsn({ titleData: { [ID]: full } }), auth, makeRemoteTitle(), now);
    await syncTitle(db, createFakePsn({ titleData: { [ID]: full } }), auth, makeRemoteTitle(), now);
    expect(await db.select().from(trophies)).toHaveLength(4);

    const trimmed = { groups: [makeGroup("default")], defs: base.defs, userTrophies: base.userTrophies };
    await syncTitle(db, createFakePsn({ titleData: { [ID]: trimmed } }), auth, makeRemoteTitle(), now);
    expect(await db.select().from(trophies)).toHaveLength(2);
    expect(await db.select().from(trophyGroups)).toHaveLength(1);
  });

  it("makes loadTitleState/titleNeedsReload agree after a sync", async () => {
    const { defs, userTrophies } = makeTrophies(3, { earnedIds: [0] });
    const gw = createFakePsn({ titleData: { [ID]: { groups: [makeGroup("default")], defs, userTrophies } } });
    const remote = makeRemoteTitle({
      earned: { platinum: 0, gold: 0, silver: 0, bronze: 1 },
      lastUpdatedAt: new Date(Date.UTC(2024, 0, 1)),
    });
    expect(await loadTitleState(db, ID)).toBeNull();
    await syncTitle(db, gw, auth, remote, now);
    expect(titleNeedsReload(await loadTitleState(db, ID), remote)).toBe(false);
  });

  it("is not reloaded after a full sync, even with 0 earned and a PSN date", async () => {
    const { defs, userTrophies } = makeTrophies(3);
    const gw = createFakePsn({ titleData: { [ID]: { groups: [makeGroup("default")], defs, userTrophies } } });
    const remote = makeRemoteTitle({ lastUpdatedAt: new Date("2025-05-05T05:05:05Z") });
    await syncTitle(db, gw, auth, remote, now);
    expect(titleNeedsReload(await loadTitleState(db, ID), remote)).toBe(false);
  });

  it("updates trophy rows with changed values and never flips earned back", async () => {
    const mk = (earned: boolean) => {
      const { defs, userTrophies } = makeTrophies(2, { earnedIds: [1] });
      if (earned) {
        userTrophies[0] = {
          trophyId: 0,
          earned: true,
          earnedAt: new Date("2025-02-02T02:02:02Z"),
          earnedRate: 1.3,
          rareCategory: 0,
          progressTarget: null,
        };
      }
      return createFakePsn({ titleData: { [ID]: { groups: [makeGroup("default")], defs, userTrophies } } });
    };
    const read = async (id: number) =>
      (await db.select().from(trophies).where(eq(trophies.trophyId, id)))[0];

    await syncTitle(db, mk(false), auth, makeRemoteTitle(), now);
    expect((await read(0)).earned).toBe(false);
    const before1 = await read(1);

    await syncTitle(db, mk(true), auth, makeRemoteTitle(), now);
    const t0 = await read(0);
    expect(t0.earned).toBe(true);
    expect(t0.earnedAt).toEqual(new Date("2025-02-02T02:02:02Z"));
    expect(t0.earnedRate).toBe("1.30");
    expect(t0.rareCategory).toBe(0);
    expect(await read(1)).toEqual(before1);

    await syncTitle(db, mk(true), auth, makeRemoteTitle(), now);
    expect(await read(0)).toEqual(t0);
    expect((await read(1)).earned).toBe(true);
  });

  it("throws on an empty trophy or group list and leaves stored rows intact", async () => {
    const { defs, userTrophies } = makeTrophies(3);
    const full = { groups: [makeGroup("default")], defs, userTrophies };
    await syncTitle(db, createFakePsn({ titleData: { [ID]: full } }), auth, makeRemoteTitle(), now);

    const noDefs = createFakePsn({ titleData: { [ID]: { ...full, defs: [], userTrophies: [] } } });
    await expect(syncTitle(db, noDefs, auth, makeRemoteTitle(), now)).rejects.toThrow(
      `Empty trophy list for ${ID}`,
    );
    const noGroups = createFakePsn({ titleData: { [ID]: { ...full, groups: [] } } });
    await expect(syncTitle(db, noGroups, auth, makeRemoteTitle(), now)).rejects.toThrow(
      `Empty group list for ${ID}`,
    );
    expect(await db.select().from(trophies)).toHaveLength(3);
    expect(await db.select().from(trophyGroups)).toHaveLength(1);
  });
});

describe("upsertTitleRow", () => {
  it("does not touch cover, play time, syncedAt or groupsCheckedAt", async () => {
    await upsertTitleRow(db, makeRemoteTitle(), now);
    await db
      .update(titles)
      .set({ coverUrl: "c", playSeconds: 9, playCount: 2, syncedAt: now, groupsCheckedAt: now });
    await upsertTitleRow(db, makeRemoteTitle({ name: "Renamed", progress: 40 }), new Date());
    const [t] = await db.select().from(titles);
    expect(t.name).toBe("Renamed");
    expect(t.progress).toBe(40);
    expect(t.coverUrl).toBe("c");
    expect(t.playSeconds).toBe(9);
    expect(t.syncedAt).toEqual(now);
    expect(t.groupsCheckedAt).toEqual(now);
  });
});
