import type { PsnGateway } from "@/src/psn/gateway";
import type {
  PsnTokens,
  RemoteCatalog,
  RemoteGroup,
  RemotePlayedGame,
  RemoteProfile,
  RemoteSummary,
  RemoteTitle,
  RemoteTrophyDef,
  RemoteUserTrophy,
} from "@/src/psn/types";

/** Per-title data served by the fake, keyed by npCommunicationId. */
export type FakeTitleData = {
  groups?: RemoteGroup[];
  defs?: RemoteTrophyDef[];
  userTrophies?: RemoteUserTrophy[];
};

/** Makes a call throw. Matches `method` and, when given, the title's npCommunicationId. */
export type FakeFailure = {
  method: keyof PsnGateway;
  npCommunicationId?: string;
  /** Thrown instead of the generic fake error. */
  error?: unknown;
};

export type FakePsnFixture = {
  /** Returned by exchangeNpsso and refresh. */
  tokens?: PsnTokens;
  summary?: RemoteSummary;
  profile?: RemoteProfile;
  titles?: RemoteTitle[];
  titleData?: Record<string, FakeTitleData>;
  playedGames?: RemotePlayedGame[];
  /** conceptId -> catalog entry; getCatalog rejects for a concept missing here. */
  catalogs?: Record<number, RemoteCatalog>;
  /** npTitleId -> npCommunicationIds, returned by mapNpTitleIds. */
  npTitleMap?: Record<string, string[]>;
  /**
   * Page size for the list methods (getTitles, getTrophyDefs, getUserTrophies,
   * getPlayedGames). Each page is one recorded call, e.g. 300 defs with
   * pageSize 100 records "getTrophyDefs:<id>" three times. Default: one page.
   */
  pageSize?: number;
  failures?: FakeFailure[];
};

export type FakePsn = PsnGateway & {
  /** One entry per call (per page for paged methods): "<method>:<npCommunicationId or ''>". */
  calls: string[];
};

const DEFAULT_TOKENS: PsnTokens = {
  accessToken: "fake-access",
  accessExpiresAt: new Date("2099-01-01T00:00:00Z"),
  refreshToken: "fake-refresh",
  refreshExpiresAt: new Date("2099-06-01T00:00:00Z"),
};
const ZERO = { platinum: 0, gold: 0, silver: 0, bronze: 0 };

export function createFakePsn(fixture: FakePsnFixture = {}): FakePsn {
  const calls: string[] = [];
  const size = fixture.pageSize ?? Number.POSITIVE_INFINITY;

  function record(method: keyof PsnGateway, id = ""): void {
    calls.push(`${method}:${id}`);
    const failure = fixture.failures?.find((f) => f.method === method && (f.npCommunicationId ?? id) === id);
    if (failure) {
      if (failure.error !== undefined) throw failure.error;
      throw new Error(`fake PSN failure: ${method}${id ? ` ${id}` : ""}`);
    }
  }

  function paged<T>(method: keyof PsnGateway, items: T[], id = ""): T[] {
    const out: T[] = [];
    let offset = 0;
    do {
      record(method, id);
      out.push(...items.slice(offset, offset + size));
      offset += size;
    } while (offset < items.length);
    return out;
  }

  const data = (id: string): FakeTitleData => fixture.titleData?.[id] ?? {};

  return {
    calls,
    async exchangeNpsso() {
      record("exchangeNpsso");
      return fixture.tokens ?? DEFAULT_TOKENS;
    },
    async refresh() {
      record("refresh");
      return fixture.tokens ?? DEFAULT_TOKENS;
    },
    async getSummary() {
      record("getSummary");
      return fixture.summary ?? { accountId: "1", level: 1, levelProgress: 0, tier: 1, earned: ZERO };
    },
    async getProfile() {
      record("getProfile");
      return fixture.profile ?? { onlineId: "Fake", avatarUrl: "" };
    },
    async getTitles() {
      return paged("getTitles", fixture.titles ?? []);
    },
    async getGroups(_auth, t) {
      record("getGroups", t.npCommunicationId);
      return data(t.npCommunicationId).groups ?? [];
    },
    async getTrophyDefs(_auth, t) {
      return paged("getTrophyDefs", data(t.npCommunicationId).defs ?? [], t.npCommunicationId);
    },
    async getUserTrophies(_auth, t) {
      return paged("getUserTrophies", data(t.npCommunicationId).userTrophies ?? [], t.npCommunicationId);
    },
    async getPlayedGames() {
      return paged("getPlayedGames", fixture.playedGames ?? []);
    },
    async getCatalog(_auth, conceptId) {
      record("getCatalog", String(conceptId));
      const catalog = fixture.catalogs?.[conceptId];
      if (!catalog) throw new Error(`fake PSN: no catalog for concept ${conceptId}`);
      return catalog;
    },
    async mapNpTitleIds(_auth, ids) {
      record("mapNpTitleIds");
      const map = fixture.npTitleMap ?? {};
      return Object.fromEntries(ids.filter((id) => map[id]).map((id) => [id, map[id]]));
    },
  };
}
