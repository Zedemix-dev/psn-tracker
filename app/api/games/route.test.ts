import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  db: {},
  isAuthenticated: vi.fn(),
  queryGames: vi.fn(),
}));
vi.mock("@/src/auth/require-session", () => ({ isAuthenticated: m.isAuthenticated }));
vi.mock("@/src/db/client", () => ({ getDb: async () => m.db }));
vi.mock("@/src/settings/repo", () => ({ getSettings: async () => ({ hideZero: false }) }));
vi.mock("@/src/games/query", async (orig) => ({
  ...(await orig<typeof import("@/src/games/query")>()),
  queryGames: m.queryGames,
}));

import { GET } from "@/app/api/games/route";

const get = (qs: string) => GET(new Request(`http://localhost/api/games?${qs}`));
const PAGE = { items: [{ id: 1 }], total: 1 };

beforeEach(() => {
  m.isAuthenticated.mockResolvedValue(true);
  m.queryGames.mockReset();
  m.queryGames.mockResolvedValue(PAGE);
});

describe("GET /api/games paging", () => {
  it("answers 401 without a session", async () => {
    m.isAuthenticated.mockResolvedValue(false);
    expect((await get("")).status).toBe(401);
  });

  it.each([
    "offset=-1",
    "limit=-5",
    "offset=1.5",
    "limit=2.5",
    "offset=abc",
    "limit=abc",
    "offset=10abc",
    "offset=1e3",
    `offset=${Number.MAX_SAFE_INTEGER + 1}`,
    `limit=${Number.MAX_SAFE_INTEGER + 1}`,
    "offset=1000001",
  ])("answers 400 for %s", async (qs) => {
    const res = await get(qs);
    expect(res.status).toBe(400);
    expect(m.queryGames).not.toHaveBeenCalled();
  });

  it.each(["", "offset=0", "offset=50", "offset=1000000", "limit=50", "offset=", "offset=50&all=1"])(
    "answers as before for %s",
    async (qs) => {
      const res = await get(qs);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(PAGE);
    },
  );

  it("passes the offset through", async () => {
    await get("offset=50");
    expect(m.queryGames.mock.calls[0][1].offset).toBe(50);
  });
});
