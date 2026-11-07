import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/src/db/client";
import { getLatestTrophies, getRarest, getRarityBreakdown } from "@/src/stats/trophies";
import { insertTitle, insertTrophies } from "@/tests/fixtures/profile";
import { createTestDb } from "@/tests/helpers/db";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await insertTitle(db, { id: "A", name: "Alpha", defined: 10, earned: 5 });
  await insertTitle(db, { id: "H", name: "Hidden", defined: 10, earned: 5, hidden: true });
});

const t = (s: string) => new Date(`2024-01-01T00:00:${s}Z`);

describe("getRarityBreakdown", () => {
  it("buckets by tier, skips null rarity, unearned and hidden titles", async () => {
    await insertTrophies(db, [
      { titleId: "A", trophyId: 1, earnedAt: t("01"), earnedRate: 1 },
      { titleId: "A", trophyId: 2, earnedAt: t("02"), earnedRate: 7 },
      { titleId: "A", trophyId: 3, earnedAt: t("03"), earnedRate: 7 },
      { titleId: "A", trophyId: 4, earnedAt: t("04"), earnedRate: null },
      { titleId: "A", trophyId: 5, earnedRate: 2 },
      { titleId: "H", trophyId: 1, earnedAt: t("01"), earnedRate: 60 },
    ]);
    expect(await getRarityBreakdown(db)).toEqual({
      "Ultra rare": 1,
      "Very rare": 2,
      Rare: 0,
      Uncommon: 0,
      Common: 0,
    });
  });
});

describe("getRarest", () => {
  it("orders by rate then earliest date, with numeric rates and no null-rate or hidden rows", async () => {
    await insertTrophies(db, [
      { titleId: "A", trophyId: 1, earnedAt: t("05"), earnedRate: 3 },
      { titleId: "A", trophyId: 2, earnedAt: t("02"), earnedRate: 3 },
      { titleId: "A", trophyId: 3, earnedAt: t("01"), earnedRate: 0.5 },
      { titleId: "A", trophyId: 4, earnedAt: t("01"), earnedRate: null },
      { titleId: "H", trophyId: 1, earnedAt: t("01"), earnedRate: 0.1 },
    ]);
    const rarest = await getRarest(db, 3);
    expect(rarest.map((r) => r.trophyId)).toEqual([3, 2, 1]);
    expect(rarest[0]).toMatchObject({ earnedRate: 0.5, gameName: "Alpha" });
  });
});

describe("getLatestTrophies", () => {
  it("is newest first with the platinum first within a second, hidden excluded, limited", async () => {
    await insertTrophies(db, [
      { titleId: "A", trophyId: 1, earnedAt: t("01") },
      { titleId: "A", trophyId: 2, earnedAt: t("09"), type: "silver" },
      { titleId: "A", trophyId: 3, earnedAt: t("09"), type: "platinum" },
      { titleId: "A", trophyId: 4, earnedAt: t("05"), earnedRate: null, detail: null },
      { titleId: "H", trophyId: 1, earnedAt: t("59") },
    ]);
    const all = await getLatestTrophies(db);
    expect(all.map((r) => r.trophyId)).toEqual([3, 2, 4, 1]);
    expect(all[2]).toMatchObject({ detail: "", earnedRate: null });
    expect(await getLatestTrophies(db, 2)).toHaveLength(2);
  });
});
