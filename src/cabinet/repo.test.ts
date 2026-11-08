import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/src/db/client";
import { getCabinet, saveCabinet, searchEarnedTrophies } from "@/src/cabinet/repo";
import { titles } from "@/src/db/schema";
import { insertTitle, insertTrophies } from "@/tests/fixtures/profile";
import { createTestDb } from "@/tests/helpers/db";

let db: Db;
const at = (s: number) => new Date(Date.UTC(2024, 0, 1, 0, 0, s));

beforeEach(async () => {
  db = await createTestDb();
  await insertTitle(db, { id: "A", name: "Alpha Quest", defined: 20 });
  await insertTitle(db, { id: "H", name: "Hidden Game", defined: 5, hidden: true });
  await insertTrophies(db, [
    ...Array.from({ length: 12 }, (_, i) => ({
      titleId: "A",
      trophyId: i + 1,
      earnedAt: at(i + 1),
      earnedRate: 50 - i,
    })),
    { titleId: "A", trophyId: 20, name: "Not earned yet" },
    { titleId: "A", trophyId: 21, name: "100% Complete_Run", earnedAt: at(30), earnedRate: 1 },
    { titleId: "A", trophyId: 22, name: "100x Complete Run", earnedAt: at(31), earnedRate: 2 },
    { titleId: "H", trophyId: 1, name: "Secret alpha", earnedAt: at(40), earnedRate: 0.1 },
  ]);
});

const e = (...ids: number[]) => ids.map((trophyId) => ({ titleId: "A", trophyId }));

describe("saveCabinet / getCabinet", () => {
  it("rejects more than 10 entries", async () => {
    await expect(saveCabinet(db, e(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11))).rejects.toThrow();
    expect(await getCabinet(db)).toEqual([]);
  });

  it("rejects duplicates and unearned trophies, leaving the cabinet untouched", async () => {
    await saveCabinet(db, e(1));
    await expect(saveCabinet(db, e(2, 2))).rejects.toThrow(/twice/i);
    await expect(saveCabinet(db, e(2, 20))).rejects.toThrow(/earned/i);
    await expect(saveCabinet(db, [{ titleId: "A", trophyId: 999 }])).rejects.toThrow(/earned/i);
    expect((await getCabinet(db)).map((t) => t.trophyId)).toEqual([1]);
  });

  it("keeps the given order and rewrites positions 1..n (3 entries, then 2)", async () => {
    await saveCabinet(db, e(3, 1, 2));
    expect((await getCabinet(db)).map((t) => t.trophyId)).toEqual([3, 1, 2]);
    await saveCabinet(db, e(2, 3));
    const after = await getCabinet(db);
    expect(after.map((t) => t.trophyId)).toEqual([2, 3]);
    expect(after[0]).toMatchObject({ gameName: "Alpha Quest", earnedRate: 49 });
    expect(after[0].earnedAt).toBeInstanceOf(Date);
  });

  it("accepts exactly 10 and an empty list", async () => {
    await saveCabinet(db, e(1, 2, 3, 4, 5, 6, 7, 8, 9, 10));
    expect(await getCabinet(db)).toHaveLength(10);
    await saveCabinet(db, []);
    expect(await getCabinet(db)).toEqual([]);
  });

  it("skips entries whose title became hidden", async () => {
    await saveCabinet(db, e(1, 2, 3));
    await db.update(titles).set({ hidden: true }).where(eq(titles.npCommunicationId, "A"));
    expect(await getCabinet(db)).toEqual([]);
  });
});

describe("searchEarnedTrophies", () => {
  it("matches trophy or game name case-insensitively, rarest first", async () => {
    const byGame = await searchEarnedTrophies(db, "ALPHA", 100);
    expect(byGame).toHaveLength(14);
    expect(byGame[0].trophyId).toBe(21);
    expect(byGame[1].trophyId).toBe(22);
    const byTrophy = await searchEarnedTrophies(db, "trophy 5");
    expect(byTrophy.map((t) => t.trophyId)).toEqual([5]);
  });

  it("excludes unearned trophies and hidden titles", async () => {
    expect(await searchEarnedTrophies(db, "Not earned")).toEqual([]);
    expect(await searchEarnedTrophies(db, "secret")).toEqual([]);
    expect(await searchEarnedTrophies(db, "Hidden Game")).toEqual([]);
  });

  it("treats % and _ literally", async () => {
    expect((await searchEarnedTrophies(db, "100%")).map((t) => t.trophyId)).toEqual([21]);
    expect((await searchEarnedTrophies(db, "e_R")).map((t) => t.trophyId)).toEqual([21]);
    expect(await searchEarnedTrophies(db, "%")).toHaveLength(1);
  });

  it("returns the rarest for an empty query and honours the limit", async () => {
    const all = await searchEarnedTrophies(db, "");
    expect(all).toHaveLength(14);
    expect(all[0].trophyId).toBe(21);
    expect(await searchEarnedTrophies(db, "  ", 3)).toHaveLength(3);
  });
});
