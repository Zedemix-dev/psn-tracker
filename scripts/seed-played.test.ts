import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/src/db/client";
import { playedGames, titles } from "@/src/db/schema";
import { getProfileStats } from "@/src/stats/profile-stats";
import { createTestDb } from "@/tests/helpers/db";
import { playedGameRows } from "./seed-played";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

const title = (id: string, playSeconds: number | null) => ({
  npCommunicationId: id,
  npServiceName: "trophy2",
  name: `Game ${id}`,
  iconUrl: `https://seed.invalid/${id}.png`,
  platforms: ["PS5"],
  trophySetVersion: "01.00",
  definedBronze: 1,
  earnedBronze: 1,
  progress: 100,
  playSeconds,
});

describe("playedGameRows", () => {
  it("links a played game to each timed list and gives a non-zero Hours played", async () => {
    const rows = [title("NPWR_A", 3600 * 33), title("NPWR_B", null), title("NPWR_C", 5 * 60)];
    await db.insert(titles).values(rows);
    const played = playedGameRows(rows);
    expect(played).toHaveLength(2);
    expect(played.map((p) => p.npCommunicationIds)).toEqual([["NPWR_A"], ["NPWR_C"]]);
    expect(new Set(played.map((p) => p.npTitleId)).size).toBe(2);
    await db.insert(playedGames).values(played);
    const stats = await getProfileStats(db, { hideZero: false });
    expect(stats.hoursSeconds).toBe(3600 * 33 + 300);
  });
});
