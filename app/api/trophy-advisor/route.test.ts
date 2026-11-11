import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/src/db/client";
import { setAdvisorDlc } from "@/src/settings/repo";
import { insertGroup, insertTitle, insertTrophies } from "@/tests/fixtures/profile";
import { createTestDb } from "@/tests/helpers/db";

const m = vi.hoisted(() => ({ db: null as unknown, isAuthenticated: vi.fn() }));
vi.mock("@/src/auth/require-session", () => ({ isAuthenticated: m.isAuthenticated }));
vi.mock("@/src/db/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/src/db/client")>()),
  getDb: async () => m.db,
}));

import { GET } from "@/app/api/trophy-advisor/route";

const get = (qs: string) => GET(new Request(`http://localhost/api/trophy-advisor?${qs}`));

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  m.db = db;
  m.isAuthenticated.mockResolvedValue(true);
  await insertTitle(db, { id: "A", name: "Alpha" });
  await insertGroup(db, { titleId: "A", groupId: "001", name: "Add-on" });
  await insertTrophies(db, [
    { titleId: "A", trophyId: 1, earnedRate: 50 },
    { titleId: "A", trophyId: 2, earnedRate: 40 },
    { titleId: "A", trophyId: 3, groupId: "001", earnedRate: 30 },
  ]);
});

describe("GET /api/trophy-advisor", () => {
  it("answers 401 without a session", async () => {
    m.isAuthenticated.mockResolvedValue(false);
    expect((await get("")).status).toBe(401);
  });

  it("reads a hand-edited address as the default first page", async () => {
    const res = await get("sort=foo&order=up&platform=PS3&rarity=epic&type=x&offset=-3&limit=0");
    expect(res.status).toBe(200);
    const page = await res.json();
    expect(page.total).toBe(3);
    expect(page.items.map((r: { key: string }) => r.key)).toEqual(["A:1", "A:2", "A:3"]);
  });

  it("reads the settings from the database", async () => {
    await setAdvisorDlc(db, "only");
    const page = await (await get("")).json();
    expect(page.items.map((r: { key: string }) => r.key)).toEqual(["A:3"]);
    expect(page.total).toBe(1);
  });

  it("pages and sorts", async () => {
    const page = await (await get("sort=rarity&order=asc&offset=1&limit=1")).json();
    expect(page.items.map((r: { key: string }) => r.key)).toEqual(["A:2"]);
    expect(page.total).toBe(3);
  });
});
