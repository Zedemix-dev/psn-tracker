import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/src/db/client";
import { playedGames, titles } from "@/src/db/schema";
import { syncPlayedGames } from "@/src/sync/played";
import { createFakePsn } from "@/tests/fakes/psn";
import { makePlayedGame } from "@/tests/fixtures/played";
import { makeRemoteTitle } from "@/tests/fixtures/titles";
import { upsertTitleRow } from "@/src/sync/title";
import { createTestDb } from "@/tests/helpers/db";

const auth = { accessToken: "tok" };
const now = new Date("2026-01-01T00:00:00Z");
const ID = "NPWR00001_00";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await upsertTitleRow(db, makeRemoteTitle({ npCommunicationId: ID }), now);
});

const getTitle = async (id = ID) =>
  (await db.select().from(titles).where(eq(titles.npCommunicationId, id)))[0];

describe("syncPlayedGames", () => {
  it("asks PSN for the mapping only once across two syncs", async () => {
    const gw = createFakePsn({
      playedGames: [makePlayedGame({ npTitleId: "A" }), makePlayedGame({ npTitleId: "B" })],
      npTitleMap: { A: [ID] },
    });

    await syncPlayedGames(db, gw, auth);
    await syncPlayedGames(db, gw, auth);

    expect(gw.calls.filter((c) => c.startsWith("mapNpTitleIds"))).toHaveLength(1);
    const b = await db.select().from(playedGames).where(eq(playedGames.npTitleId, "B"));
    expect(b[0].npCommunicationIds).toEqual([]);
  });

  it("sums play time and counts and takes the latest play and cover over linked games", async () => {
    const gw = createFakePsn({
      playedGames: [
        makePlayedGame({
          npTitleId: "A",
          playSeconds: 100,
          playCount: 2,
          imageUrl: "https://img.example/a.png",
          lastPlayedAt: new Date("2025-03-01T00:00:00Z"),
        }),
        makePlayedGame({
          npTitleId: "B",
          playSeconds: 50,
          playCount: 3,
          imageUrl: "https://img.example/b.png",
          lastPlayedAt: new Date("2025-05-01T00:00:00Z"),
        }),
      ],
      npTitleMap: { A: [ID], B: [ID] },
    });

    await syncPlayedGames(db, gw, auth);

    const t = await getTitle();
    expect(t.playSeconds).toBe(150);
    expect(t.playCount).toBe(5);
    expect(t.lastPlayedAt).toEqual(new Date("2025-05-01T00:00:00Z"));
    expect(t.coverUrl).toBe("https://img.example/b.png");
  });

  it("keeps totals correct when play time grows on an already linked game", async () => {
    const first = createFakePsn({
      playedGames: [makePlayedGame({ npTitleId: "A", playSeconds: 100 })],
      npTitleMap: { A: [ID] },
    });
    await syncPlayedGames(db, first, auth);

    const second = createFakePsn({
      playedGames: [makePlayedGame({ npTitleId: "A", playSeconds: 400 })],
      npTitleMap: { A: [ID] },
    });
    await syncPlayedGames(db, second, auth);

    expect(second.calls.some((c) => c.startsWith("mapNpTitleIds"))).toBe(false);
    expect((await getTitle()).playSeconds).toBe(400);
  });

  it("leaves a title without a played game with a null cover and its previous play columns", async () => {
    const other = "NPWR00002_00";
    await upsertTitleRow(db, makeRemoteTitle({ npCommunicationId: other }), now);
    await db.update(titles).set({ playSeconds: 77 }).where(eq(titles.npCommunicationId, other));
    const gw = createFakePsn({
      playedGames: [makePlayedGame({ npTitleId: "A" }), makePlayedGame({ npTitleId: "Z" })],
      npTitleMap: { A: [ID] },
    });

    await syncPlayedGames(db, gw, auth);

    const t = await getTitle(other);
    expect(t.coverUrl).toBeNull();
    expect(t.playSeconds).toBe(77);
  });

  it("ignores links to titles that do not exist", async () => {
    const gw = createFakePsn({
      playedGames: [makePlayedGame({ npTitleId: "A" })],
      npTitleMap: { A: ["NPWR99999_00"] },
    });
    await syncPlayedGames(db, gw, auth);
    expect(await db.select().from(titles)).toHaveLength(1);
  });
});
