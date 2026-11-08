import {
  call,
  exchangeAccessCodeForAuthTokens,
  exchangeNpssoForAccessCode,
  exchangeRefreshTokenForAuthTokens,
  getTitleTrophies,
  getTitleTrophyGroups,
  getUserTitles,
  getUserTrophiesEarnedForTitle,
  getUserTrophiesForSpecificTitle,
  getUserTrophyProfileSummary,
  type AuthTokensResponse,
  type TrophyCounts as ApiTrophyCounts,
  type ProfileFromAccountIdResponse,
  type UserPlayedGamesResponse,
} from "psn-api";
import type {
  PsnTokens,
  RemoteCatalog,
  RemoteConcept,
  RemoteGroup,
  RemotePlayedGame,
  RemoteProfile,
  RemoteSummary,
  RemoteTitle,
  RemoteTrophyDef,
  RemoteUserTrophy,
  TitleRef,
  TrophyCounts,
  TrophyType,
} from "@/src/psn/types";

type CatalogResponse = {
  publisherName?: string;
  releaseDate?: { date?: string };
  localizedGenres?: Array<{ value: string }>;
};

export type PsnAuth = { accessToken: string };

export interface PsnGateway {
  exchangeNpsso(npsso: string): Promise<PsnTokens>;
  refresh(refreshToken: string): Promise<PsnTokens>;
  getSummary(auth: PsnAuth): Promise<RemoteSummary>;
  getProfile(auth: PsnAuth, accountId: string): Promise<RemoteProfile>;
  getTitles(auth: PsnAuth): Promise<RemoteTitle[]>;
  getGroups(auth: PsnAuth, t: TitleRef): Promise<RemoteGroup[]>;
  getTrophyDefs(auth: PsnAuth, t: TitleRef): Promise<RemoteTrophyDef[]>;
  getUserTrophies(auth: PsnAuth, t: TitleRef): Promise<RemoteUserTrophy[]>;
  getPlayedGames(auth: PsnAuth): Promise<RemotePlayedGame[]>;
  getCatalog(auth: PsnAuth, conceptId: number): Promise<RemoteCatalog>;
  /** npTitleId -> npCommunicationIds */
  mapNpTitleIds(auth: PsnAuth, ids: string[]): Promise<Record<string, string[]>>;
}

const TITLES_PAGE = 800;
const PLAYED_PAGE = 200;
const NP_TITLE_IDS_PER_CALL = 5;
const PROFILE_URL = "https://m.np.playstation.com/api/userProfile/v1/internal/users";
const GAMELIST_URL = "https://m.np.playstation.com/api/gamelist/v2/users/me/titles";
const CATALOG_URL = "https://m.np.playstation.com/api/catalog/v2/concepts";
const LOGO_WIDTH = 800;

function toTokens(r: AuthTokensResponse, now = Date.now()): PsnTokens {
  return {
    accessToken: r.accessToken,
    accessExpiresAt: new Date(now + r.expiresIn * 1000),
    refreshToken: r.refreshToken,
    refreshExpiresAt: new Date(now + r.refreshTokenExpiresIn * 1000),
  };
}

function toCounts(c: ApiTrophyCounts): TrophyCounts {
  return { platinum: c.platinum, gold: c.gold, silver: c.silver, bronze: c.bronze };
}

function toDate(s: string | undefined | null): Date | null {
  return s ? new Date(s) : null;
}

/** ISO 8601 duration (e.g. PT228H56M33S) to seconds. */
export function parseIsoDuration(iso: string | undefined | null): number {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(iso ?? "");
  if (!m) return 0;
  const [, d, h, min, s] = m;
  return Math.round(Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(min ?? 0) * 60 + Number(s ?? 0));
}

function toRate(s: string | undefined | null): number | null {
  if (s === undefined || s === null || s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Integer from a PSN string value ("5000"); null when missing or not numeric. */
function toInt(s: string | undefined | null): number | null {
  const n = toRate(s);
  return n === null ? null : Math.trunc(n);
}

/** PSN language ("en-GB", "en") to the catalog's country and language parameters. */
export function catalogLocale(language: string): { country: string; language: string } {
  const [lang, region] = language.split("-");
  return { country: region?.toUpperCase() ?? "US", language: lang.toLowerCase() };
}

type ApiConcept = { id: number; media?: { images?: Array<{ type: string; url: string }> } };

function toConcept(c: ApiConcept | null | undefined): RemoteConcept | null {
  if (!c) return null;
  const image = (type: string) => c.media?.images?.find((i) => i.type === type)?.url ?? null;
  const logo = image("LOGO");
  return {
    id: c.id,
    bannerUrl: image("GAMEHUB_COVER_ART"),
    logoUrl: logo === null ? null : `${logo}?w=${LOGO_WIDTH}`,
  };
}

/** Follows offset/nextOffset until every item has been fetched. */
async function paginate<T>(
  fetchPage: (offset: number) => Promise<{ items: T[]; total: number; next?: number }>,
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  for (;;) {
    const page = await fetchPage(offset);
    all.push(...page.items);
    const next = page.next ?? offset + page.items.length;
    if (page.items.length === 0 || next >= page.total || next <= offset) return all;
    offset = next;
  }
}

export function createPsnGateway(language: string): PsnGateway {
  const headerOverrides = { "Accept-Language": language };

  return {
    async exchangeNpsso(npsso) {
      const code = await exchangeNpssoForAccessCode(npsso);
      return toTokens(await exchangeAccessCodeForAuthTokens(code));
    },

    async refresh(refreshToken) {
      return toTokens(await exchangeRefreshTokenForAuthTokens(refreshToken));
    },

    async getSummary(auth) {
      const r = await getUserTrophyProfileSummary(auth, "me", { headerOverrides });
      return {
        accountId: r.accountId,
        level: Number(r.trophyLevel),
        levelProgress: r.progress,
        tier: r.tier,
        earned: toCounts(r.earnedTrophies),
      };
    },

    async getProfile(auth, accountId) {
      // getProfileFromAccountId ignores headerOverrides: same URL through the low-level helper.
      const r = await call<ProfileFromAccountIdResponse & { error?: { message?: string } }>(
        { url: `${PROFILE_URL}/${encodeURIComponent(accountId)}/profiles`, headers: headerOverrides },
        auth,
      );
      if (r.error) throw new Error(r.error.message ?? "Unexpected Error");
      const avatar = r.avatars.find((a) => a.size === "xl") ?? r.avatars[0];
      return { onlineId: r.onlineId, avatarUrl: avatar?.url ?? "" };
    },

    async getTitles(auth) {
      return paginate(async (offset) => {
        const r = await getUserTitles(auth, "me", { limit: TITLES_PAGE, offset, headerOverrides });
        return {
          total: r.totalItemCount,
          next: r.nextOffset,
          items: r.trophyTitles.map(
            (t): RemoteTitle => ({
              npCommunicationId: t.npCommunicationId,
              npServiceName: t.npServiceName,
              name: t.trophyTitleName,
              iconUrl: t.trophyTitleIconUrl,
              platforms: t.trophyTitlePlatform ? t.trophyTitlePlatform.split(",") : [],
              trophySetVersion: t.trophySetVersion,
              hasTrophyGroups: t.hasTrophyGroups,
              defined: toCounts(t.definedTrophies),
              earned: toCounts(t.earnedTrophies),
              progress: t.progress,
              hidden: t.hiddenFlag,
              lastUpdatedAt: toDate(t.lastUpdatedDateTime),
            }),
          ),
        };
      });
    },

    async getGroups(auth, t) {
      const r = await getTitleTrophyGroups(auth, t.npCommunicationId, {
        npServiceName: t.npServiceName,
        headerOverrides,
      });
      return r.trophyGroups.map((g) => ({
        groupId: g.trophyGroupId,
        name: g.trophyGroupName,
        iconUrl: g.trophyGroupIconUrl,
        defined: toCounts(g.definedTrophies),
      }));
    },

    async getTrophyDefs(auth, t) {
      return paginate(async (offset) => {
        const r = await getTitleTrophies(auth, t.npCommunicationId, "all", {
          npServiceName: t.npServiceName,
          offset,
          headerOverrides,
        });
        return {
          total: r.totalItemCount,
          next: r.nextOffset,
          items: (r.trophies as Array<(typeof r.trophies)[number] & { trophyProgressTargetValue?: string }>).map(
            (d): RemoteTrophyDef => ({
              trophyId: d.trophyId,
              groupId: d.trophyGroupId ?? "default",
              type: d.trophyType as TrophyType,
              name: d.trophyName ?? "",
              detail: d.trophyDetail ?? "",
              iconUrl: d.trophyIconUrl ?? "",
              hidden: d.trophyHidden,
              progressTarget: toInt(d.trophyProgressTargetValue),
            }),
          ),
        };
      });
    },

    async getUserTrophies(auth, t) {
      return paginate(async (offset) => {
        const r = await getUserTrophiesEarnedForTitle(auth, "me", t.npCommunicationId, "all", {
          npServiceName: t.npServiceName,
          offset,
          headerOverrides,
        });
        return {
          total: r.totalItemCount,
          next: r.nextOffset,
          items: (r.trophies as Array<(typeof r.trophies)[number] & { progress?: string; progressedDateTime?: string }>).map(
            (u): RemoteUserTrophy => ({
              trophyId: u.trophyId,
              earned: u.earned ?? false,
              earnedAt: toDate(u.earnedDateTime),
              earnedRate: toRate(u.trophyEarnedRate),
              rareCategory: u.trophyRare ?? null,
              progress: toInt(u.progress),
              progressedAt: toDate(u.progressedDateTime),
            }),
          ),
        };
      });
    },

    async getPlayedGames(auth) {
      // getUserPlayedGames has no headerOverrides option: same URL through the low-level helper.
      return paginate(async (offset) => {
        const url = `${GAMELIST_URL}?${new URLSearchParams({
          categories: "ps4_game,ps5_native_game",
          limit: String(PLAYED_PAGE),
          offset: String(offset),
        })}`;
        const r = await call<UserPlayedGamesResponse & { error?: { message?: string } }>(
          { url, headers: headerOverrides },
          auth,
        );
        if (r.error) throw new Error(r.error.message ?? "Unexpected Error");
        return {
          total: r.totalItemCount,
          next: r.nextOffset,
          items: r.titles.map(
            (g): RemotePlayedGame => ({
              npTitleId: g.titleId,
              name: g.name,
              imageUrl: g.imageUrl,
              playSeconds: parseIsoDuration(g.playDuration),
              playCount: g.playCount,
              firstPlayedAt: toDate(g.firstPlayedDateTime),
              lastPlayedAt: toDate(g.lastPlayedDateTime),
              concept: toConcept(g.concept),
            }),
          ),
        };
      });
    },

    async getCatalog(auth, conceptId) {
      const url = `${CATALOG_URL}/${conceptId}?${new URLSearchParams(catalogLocale(language))}&age=99`;
      const r = await call<CatalogResponse & { error?: { message?: string } }>(
        { url, headers: headerOverrides },
        auth,
      );
      if (r.error) throw new Error(r.error.message ?? "Unexpected Error");
      return {
        publisher: r.publisherName ?? null,
        releaseDate: toDate(r.releaseDate?.date),
        genres: [...new Set((r.localizedGenres ?? []).map((g) => g.value))],
      };
    },

    async mapNpTitleIds(auth, ids) {
      const out: Record<string, string[]> = {};
      for (let i = 0; i < ids.length; i += NP_TITLE_IDS_PER_CALL) {
        const chunk = ids.slice(i, i + NP_TITLE_IDS_PER_CALL);
        const r = await getUserTrophiesForSpecificTitle(auth, "me", {
          npTitleIds: chunk.join(","),
          headerOverrides,
        });
        for (const title of r.titles) {
          out[title.npTitleId] = title.trophyTitles.map((t) => t.npCommunicationId);
        }
      }
      return out;
    },
  };
}
