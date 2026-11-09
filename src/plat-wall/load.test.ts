import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/src/db/client";
import { loadPlatinums } from "@/src/plat-wall/load";
import { insertTitle, insertTrophies } from "@/tests/fixtures/profile";
import { createTestDb } from "@/tests/helpers/db";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe("loadPlatinums", () => {
  it("keeps earned platinums of visible games, newest first", async () => {
    await insertTitle(db, { id: "A", name: "Alpha", platforms: ["PS4", "PS5"] });
    await insertTitle(db, { id: "B", name: "Beta" });
    await insertTitle(db, { id: "C", name: "Gamma" });
    await insertTitle(db, { id: "H", name: "Hidden", hidden: true });
    await insertTrophies(db, [
      { titleId: "A", trophyId: 0, type: "platinum", earnedAt: new Date("2024-01-01T00:00:00Z"), earnedRate: 17.76 },
      { titleId: "A", trophyId: 1, type: "gold", earnedAt: new Date("2024-01-02T00:00:00Z") },
      { titleId: "B", trophyId: 7, type: "platinum", earnedAt: new Date("2025-01-01T00:00:00Z"), earnedRate: null },
      { titleId: "C", trophyId: 0, type: "platinum" },
      { titleId: "H", trophyId: 0, type: "platinum", earnedAt: new Date("2025-06-01T00:00:00Z") },
    ]);
    const out = await loadPlatinums(db);
    expect(out.map((p) => p.game)).toEqual(["Beta", "Alpha"]);
    expect(out[0]).toMatchObject({ titleId: "B", rate: null, platforms: ["PS5"] });
    expect(out[1]).toMatchObject({ rate: 17.76, platforms: ["PS4", "PS5"] });
    // The platinum trophy's own icon, never the game's.
    expect(out.map((p) => p.iconUrl)).toEqual(["https://img.example/t7.png", "https://img.example/t0.png"]);
    expect(out[1].earnedAt).toEqual(new Date("2024-01-01T00:00:00Z"));
  });
});
