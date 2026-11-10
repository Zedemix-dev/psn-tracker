import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_LOG_QUERY, LOG_MAX } from "@/src/trophy-log/query";

const m = vi.hoisted(() => ({
  db: {},
  isAuthenticated: vi.fn(),
  queryTrophyLog: vi.fn(),
}));
vi.mock("@/src/auth/require-session", () => ({ isAuthenticated: m.isAuthenticated }));
vi.mock("@/src/db/client", () => ({ getDb: async () => m.db }));
vi.mock("@/src/trophy-log/load", () => ({ queryTrophyLog: m.queryTrophyLog }));

import { GET } from "@/app/api/trophy-log/route";

const get = (qs: string) => GET(new Request(`http://localhost/api/trophy-log?${qs}`));
const PAGE = { items: [{ key: "CP:7", n: 3 }], total: 1 };

beforeEach(() => {
  m.isAuthenticated.mockResolvedValue(true);
  m.queryTrophyLog.mockReset();
  m.queryTrophyLog.mockResolvedValue(PAGE);
});

describe("GET /api/trophy-log", () => {
  it("answers 401 without a session", async () => {
    m.isAuthenticated.mockResolvedValue(false);
    expect((await get("")).status).toBe(401);
    expect(m.queryTrophyLog).not.toHaveBeenCalled();
  });

  it("reads garbage as the defaults", async () => {
    const res = await get("sort=foo&order=up&platform=PS3&rarity=epic&type=x&offset=-3&limit=0");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(PAGE);
    expect(m.queryTrophyLog).toHaveBeenCalledWith(m.db, DEFAULT_LOG_QUERY, { offset: 0, limit: 50 });
  });

  it("passes the settings and the paging", async () => {
    await get("sort=rarity&type=gold&offset=50");
    expect(m.queryTrophyLog).toHaveBeenCalledWith(
      m.db,
      { ...DEFAULT_LOG_QUERY, sort: "rarity", order: "asc", type: "gold" },
      { offset: 50, limit: 50 },
    );
  });

  it("loads the rest with all=1", async () => {
    await get("offset=50&all=1");
    expect(m.queryTrophyLog).toHaveBeenCalledWith(m.db, DEFAULT_LOG_QUERY, { offset: 50, limit: LOG_MAX });
  });
});
