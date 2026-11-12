import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalogLocale, createPsnGateway, parseIsoDuration, PsnRefusedError } from "@/src/psn/gateway";

type Req = { url: URL; headers: Record<string, string> };
let requests: Req[];
let routes: Array<[RegExp, (url: URL) => unknown]>;

const counts = { platinum: 0, gold: 1, silver: 2, bronze: 3 };
const auth = { accessToken: "tok" };
const trophy = { npCommunicationId: "NPWR1_00", npServiceName: "trophy" as const };
const trophy2 = { npCommunicationId: "NPWR2_00", npServiceName: "trophy2" as const };

beforeEach(() => {
  requests = [];
  routes = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      requests.push({ url, headers: { ...(init?.headers as Record<string, string>) } });
      const route = routes.find(([re]) => re.test(url.pathname));
      if (!route) throw new Error(`unexpected request ${url}`);
      const body = route[1](url);
      if (body instanceof Response) return body;
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const on = (re: RegExp, body: (url: URL) => unknown) => routes.push([re, body]);

describe("parseIsoDuration", () => {
  it("converts ISO 8601 durations to seconds", () => {
    expect(parseIsoDuration("PT228H56M33S")).toBe(228 * 3600 + 56 * 60 + 33);
    expect(parseIsoDuration("PT45S")).toBe(45);
    expect(parseIsoDuration("PT1H")).toBe(3600);
    expect(parseIsoDuration("")).toBe(0);
  });
});

describe("createPsnGateway", () => {
  const gw = createPsnGateway("en-GB");

  describe("token answers", () => {
    const good = { access_token: "a", expires_in: 3600, refresh_token: "r", refresh_token_expires_in: 5183999 };

    it("refresh accepts a real token answer", async () => {
      on(/oauth\/token$/, () => good);
      const t = await gw.refresh("old");
      expect(t.accessToken).toBe("a");
      expect(t.refreshToken).toBe("r");
      expect(Number.isNaN(t.accessExpiresAt.getTime())).toBe(false);
      expect(Number.isNaN(t.refreshExpiresAt.getTime())).toBe(false);
    });

    it("refresh throws PsnRefusedError when PSN answers without a token", async () => {
      on(/oauth\/token$/, () => ({ error: "invalid_grant", error_description: "Invalid refresh token" }));
      await expect(gw.refresh("old")).rejects.toBeInstanceOf(PsnRefusedError);
    });

    it("refresh throws PsnRefusedError on an empty token or a non-numeric expiry", async () => {
      on(/oauth\/token$/, () => ({ ...good, access_token: "" }));
      await expect(gw.refresh("old")).rejects.toBeInstanceOf(PsnRefusedError);
      routes = [];
      on(/oauth\/token$/, () => ({ ...good, expires_in: "3600" }));
      await expect(gw.refresh("old")).rejects.toBeInstanceOf(PsnRefusedError);
    });

    it("exchangeNpsso throws PsnRefusedError when the token answer has no token", async () => {
      on(/oauth\/authorize$/, () => new Response(null, { status: 302, headers: { location: "com.scee.psxandroid.scecompcall://redirect/?code=v3.abc" } }));
      on(/oauth\/token$/, () => ({ error: "invalid_grant" }));
      await expect(gw.exchangeNpsso("n".repeat(64))).rejects.toBeInstanceOf(PsnRefusedError);
    });

    it("a non-JSON answer is not a refusal", async () => {
      on(/oauth\/token$/, () => new Response("<html>503</html>", { status: 503 }));
      const err = await gw.refresh("old").then(
        () => null,
        (e: unknown) => e,
      );
      expect(err).toBeInstanceOf(Error);
      expect(err).not.toBeInstanceOf(PsnRefusedError);
    });
  });

  it("sends Accept-Language and the auth header on every call", async () => {
    on(/trophySummary/, () => ({ accountId: "1", trophyLevel: "42", progress: 7, tier: 5, earnedTrophies: counts }));
    on(/\/profiles/, () => ({ onlineId: "Zmx969", avatars: [{ size: "s", url: "s.png" }, { size: "xl", url: "xl.png" }] }));
    on(/\/users\/me\/trophyTitles$/, () => ({ trophyTitles: [], totalItemCount: 0 }));
    on(/trophyGroups$/, () => ({ trophyGroups: [] }));
    on(/\/trophies$/, () => ({ trophies: [], totalItemCount: 0 }));
    on(/gamelist/, () => ({ titles: [], totalItemCount: 0, nextOffset: 0 }));
    on(/titles\/trophyTitles/, () => ({ titles: [] }));

    await gw.getSummary(auth);
    await gw.getProfile(auth, "123");
    await gw.getTitles(auth);
    await gw.getGroups(auth, trophy);
    await gw.getTrophyDefs(auth, trophy);
    await gw.getUserTrophies(auth, trophy);
    await gw.getPlayedGames(auth);
    await gw.mapNpTitleIds(auth, ["CUSA1_00"]);

    expect(requests).toHaveLength(8);
    for (const r of requests) {
      expect(r.headers["Accept-Language"]).toBe("en-GB");
      expect(r.headers.Authorization).toBe("Bearer tok");
    }
  });

  it("maps the summary and profile", async () => {
    on(/trophySummary/, () => ({ accountId: "1", trophyLevel: "42", progress: 7, tier: 5, earnedTrophies: counts }));
    on(/\/profiles/, () => ({ onlineId: "Zmx969", avatars: [{ size: "s", url: "s.png" }, { size: "xl", url: "xl.png" }] }));
    expect(await gw.getSummary(auth)).toEqual({ accountId: "1", level: 42, levelProgress: 7, tier: 5, earned: counts });
    expect(requests[0].url.pathname).toContain("/users/me/trophySummary");
    expect(await gw.getProfile(auth, "123")).toEqual({ onlineId: "Zmx969", avatarUrl: "xl.png" });
  });

  it("pages titles with limit 800 and maps them", async () => {
    const title = (id: string) => ({
      npCommunicationId: id,
      npServiceName: "trophy2",
      trophyTitleName: `T ${id}`,
      trophyTitleIconUrl: "i.png",
      trophyTitlePlatform: "PS5,PS4",
      trophySetVersion: "01.00",
      hasTrophyGroups: false,
      definedTrophies: counts,
      earnedTrophies: counts,
      progress: 50,
      hiddenFlag: false,
      lastUpdatedDateTime: "2026-01-02T03:04:05Z",
    });
    on(/\/users\/me\/trophyTitles$/, (url) =>
      url.searchParams.get("offset") === "0"
        ? { trophyTitles: [title("A"), title("B")], totalItemCount: 3, nextOffset: 2 }
        : { trophyTitles: [title("C")], totalItemCount: 3 },
    );
    const titles = await gw.getTitles(auth);
    expect(titles.map((t) => t.npCommunicationId)).toEqual(["A", "B", "C"]);
    expect(requests.map((r) => r.url.searchParams.get("limit"))).toEqual(["800", "800"]);
    expect(requests.map((r) => r.url.searchParams.get("offset"))).toEqual(["0", "2"]);
    expect(titles[0]).toMatchObject({
      npServiceName: "trophy2",
      name: "T A",
      platforms: ["PS5", "PS4"],
      lastUpdatedAt: new Date("2026-01-02T03:04:05Z"),
    });
  });

  it("passes the title's npServiceName on per-title calls and pages them", async () => {
    on(/trophyGroups$/, () => ({
      trophyGroups: [{ trophyGroupId: "default", trophyGroupName: "Base", trophyGroupIconUrl: "g.png", definedTrophies: counts }],
    }));
    on(/users\/me\/npCommunicationIds\/.*\/trophies$/, (url) =>
      url.searchParams.get("offset") === "0"
        ? {
            trophies: [{ trophyId: 0, trophyHidden: false, earned: true, earnedDateTime: "2026-02-03T00:00:00Z", trophyEarnedRate: "12.5", trophyRare: 2 }],
            totalItemCount: 2,
            nextOffset: 1,
          }
        : { trophies: [{ trophyId: 1, trophyHidden: false, trophyEarnedRate: "" }], totalItemCount: 2 },
    );
    on(/^\/api\/trophy\/v1\/npCommunicationIds\/.*\/trophies$/, () => ({
      trophies: [{ trophyId: 0, trophyHidden: true, trophyType: "gold", trophyName: "N", trophyDetail: "D", trophyIconUrl: "t.png", trophyGroupId: "001" }],
      totalItemCount: 1,
    }));

    expect(await gw.getGroups(auth, trophy2)).toEqual([{ groupId: "default", name: "Base", iconUrl: "g.png", defined: counts }]);
    expect(await gw.getTrophyDefs(auth, trophy)).toEqual([
      { trophyId: 0, groupId: "001", type: "gold", name: "N", detail: "D", iconUrl: "t.png", hidden: true, progressTarget: null },
    ]);
    const user = await gw.getUserTrophies(auth, trophy2);
    expect(user).toEqual([
      { trophyId: 0, earned: true, earnedAt: new Date("2026-02-03T00:00:00Z"), earnedRate: 12.5, rareCategory: 2, progress: null, progressedAt: null },
      { trophyId: 1, earned: false, earnedAt: null, earnedRate: null, rareCategory: null, progress: null, progressedAt: null },
    ]);

    expect(requests.map((r) => r.url.searchParams.get("npServiceName"))).toEqual(["trophy2", "trophy", "trophy2", "trophy2"]);
  });

  it("maps played games with seconds and dates", async () => {
    on(/gamelist/, () => ({
      titles: [{ titleId: "CUSA1_00", name: "G", imageUrl: "g.png", playCount: 4, playDuration: "PT1H2M3S", firstPlayedDateTime: "2025-01-01T00:00:00Z", lastPlayedDateTime: "2025-02-01T00:00:00Z" }],
      totalItemCount: 1,
      nextOffset: 1,
    }));
    expect(await gw.getPlayedGames(auth)).toEqual([
      { npTitleId: "CUSA1_00", name: "G", imageUrl: "g.png", playSeconds: 3723, playCount: 4, firstPlayedAt: new Date("2025-01-01T00:00:00Z"), lastPlayedAt: new Date("2025-02-01T00:00:00Z"), concept: null },
    ]);
  });

  it("maps npTitleIds in chunks of 5", async () => {
    on(/titles\/trophyTitles/, (url) => ({
      titles: url.searchParams.get("npTitleIds")!.split(",").map((id) => ({ npTitleId: id, trophyTitles: [{ npCommunicationId: `NPWR_${id}` }] })),
    }));
    const ids = ["A", "B", "C", "D", "E", "F", "G"];
    const map = await gw.mapNpTitleIds(auth, ids);
    expect(requests.map((r) => r.url.searchParams.get("npTitleIds"))).toEqual(["A,B,C,D,E", "F,G"]);
    expect(map).toEqual(Object.fromEntries(ids.map((id) => [id, [`NPWR_${id}`]])));
  });

  it("reads the progress target from definitions and the progress from the user state", async () => {
    on(/^\/api\/trophy\/v1\/npCommunicationIds\/.*\/trophies$/, () => ({
      trophies: [
        { trophyId: 0, trophyHidden: false, trophyType: "bronze", trophyProgressTargetValue: "5000" },
        { trophyId: 1, trophyHidden: false, trophyType: "bronze", trophyProgressTargetValue: "abc" },
      ],
      totalItemCount: 2,
    }));
    on(/users\/me\/npCommunicationIds\/.*\/trophies$/, () => ({
      trophies: [
        { trophyId: 0, trophyHidden: false, progress: "3626", progressedDateTime: "2023-02-05T09:36:54Z" },
        { trophyId: 1, trophyHidden: false, progress: "n/a" },
      ],
      totalItemCount: 2,
    }));
    const defs = await gw.getTrophyDefs(auth, trophy);
    expect(defs.map((d) => d.progressTarget)).toEqual([5000, null]);
    const user = await gw.getUserTrophies(auth, trophy);
    expect(user[0]).toMatchObject({ progress: 3626, progressedAt: new Date("2023-02-05T09:36:54Z") });
    expect(user[1]).toMatchObject({ progress: null, progressedAt: null });
  });

  it("maps the played game concept to its banner and its logo resized to 800 px", async () => {
    const base = { name: "G", imageUrl: "g.png", playCount: 1, playDuration: "PT1H" };
    on(/gamelist/, () => ({
      titles: [
        {
          ...base,
          titleId: "A",
          concept: {
            id: 234567,
            media: {
              images: [
                { type: "MASTER", url: "https://img.example/master.png" },
                { type: "GAMEHUB_COVER_ART", url: "https://img.example/a1krx.png" },
                { type: "LOGO", url: "https://img.example/logo.png" },
              ],
            },
          },
        },
        { ...base, titleId: "B" },
      ],
      totalItemCount: 2,
      nextOffset: 2,
    }));
    const games = await gw.getPlayedGames(auth);
    expect(games[0].concept).toEqual({
      id: 234567,
      bannerUrl: "https://img.example/a1krx.png",
      logoUrl: "https://img.example/logo.png?w=800",
    });
    expect(games[1].concept).toBeNull();
  });

  it("fetches the catalog with country, language and age together", async () => {
    on(/catalog\/v2\/concepts\/234567$/, () => ({
      publisherName: "CD PROJEKT RED S.A.",
      releaseDate: { date: "2020-12-10T00:00:00Z" },
      localizedGenres: [{ value: "Role Playing Games" }, { value: "Role Playing Games" }],
    }));
    on(/catalog\/v2\/concepts\/1$/, () => ({ error: { message: "x" } }));
    expect(await gw.getCatalog(auth, 234567)).toEqual({
      publisher: "CD PROJEKT RED S.A.",
      releaseDate: new Date("2020-12-10T00:00:00Z"),
      genres: ["Role Playing Games"],
    });
    expect(requests[0].url.searchParams.get("country")).toBe("GB");
    expect(requests[0].url.searchParams.get("language")).toBe("en");
    expect(requests[0].url.searchParams.get("age")).toBe("99");
    expect(requests[0].headers["Accept-Language"]).toBe("en-GB");
    await expect(gw.getCatalog(auth, 1)).rejects.toThrow("x");
  });

  it("derives the catalog locale from the PSN language", () => {
    expect(catalogLocale("en-GB")).toEqual({ country: "GB", language: "en" });
    expect(catalogLocale("en")).toEqual({ country: "US", language: "en" });
  });
});
