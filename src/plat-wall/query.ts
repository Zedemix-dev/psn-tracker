import { parisYear } from "@/src/lib/format";

export const PLAT_PLATFORMS = ["all", "PS4", "PS5"] as const;
export const PLAT_SORTS = ["newest", "rarity", "alphabetical"] as const;
export const PLAT_SHOW = ["art", "rarity", "name"] as const;
export type PlatPlatform = (typeof PLAT_PLATFORMS)[number];
export type PlatSort = (typeof PLAT_SORTS)[number];
export type PlatShow = (typeof PLAT_SHOW)[number];
/** `show` is never empty and always in PLAT_SHOW order. */
export type PlatQuery = { year: number | null; platform: PlatPlatform; sort: PlatSort; show: PlatShow[] };
export type Platinum = {
  titleId: string;
  game: string;
  iconUrl: string;
  earnedAt: Date;
  rate: number | null;
  platforms: string[];
};

const DEFAULT_SHOW: PlatShow[] = ["art"];

function pick<T extends string>(allowed: readonly T[], value: string | null, fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function parseYear(value: string | null): number | null {
  return value !== null && /^\d{4}$/.test(value) ? Number(value) : null;
}

/** The values in PLAT_SHOW order, or null when absent, empty or containing a bad one. */
function parseShow(value: string | null): PlatShow[] | null {
  if (value === null) return null;
  const parts = value.split(",");
  if (!parts.every((p) => PLAT_SHOW.includes(p as PlatShow))) return null;
  return PLAT_SHOW.filter((s) => parts.includes(s));
}

export function parsePlatQuery(params: URLSearchParams): PlatQuery {
  return {
    year: parseYear(params.get("year")),
    platform: pick(PLAT_PLATFORMS, params.get("platform"), "all"),
    sort: pick(PLAT_SORTS, params.get("sort"), "newest"),
    show: parseShow(params.get("show")) ?? [...DEFAULT_SHOW],
  };
}

export function arePlatParamsValid(params: URLSearchParams): boolean {
  const year = params.get("year");
  const platform = params.get("platform");
  const sort = params.get("sort");
  const show = params.get("show");
  return (
    (year === null || parseYear(year) !== null) &&
    (platform === null || PLAT_PLATFORMS.includes(platform as PlatPlatform)) &&
    (sort === null || PLAT_SORTS.includes(sort as PlatSort)) &&
    (show === null || parseShow(show) !== null)
  );
}

export function platQueryParams(query: PlatQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.year !== null) params.set("year", String(query.year));
  if (query.platform !== "all") params.set("platform", query.platform);
  if (query.sort !== "newest") params.set("sort", query.sort);
  if (query.show.join(",") !== DEFAULT_SHOW.join(",")) params.set("show", query.show.join(","));
  return params;
}

const byNewest = (a: Platinum, b: Platinum) => b.earnedAt.getTime() - a.earnedAt.getTime();

export function applyPlatQuery(all: Platinum[], query: PlatQuery): Platinum[] {
  const kept = all.filter(
    (p) =>
      (query.year === null || parisYear(p.earnedAt) === query.year) &&
      (query.platform === "all" || p.platforms.includes(query.platform)),
  );
  switch (query.sort) {
    case "newest":
      return kept.sort(byNewest);
    case "rarity":
      return kept.sort((a, b) => {
        if (a.rate === b.rate) return byNewest(a, b);
        if (a.rate === null) return 1;
        if (b.rate === null) return -1;
        return a.rate - b.rate;
      });
    case "alphabetical":
      return kept.sort((a, b) => a.game.localeCompare(b.game, "en", { sensitivity: "base" }) || byNewest(a, b));
  }
}

export function platinumYears(all: Platinum[]): number[] {
  return [...new Set(all.map((p) => parisYear(p.earnedAt)))].sort((a, b) => b - a);
}

export function exportFileName(onlineId: string, query: PlatQuery): string {
  const parts = [onlineId.replace(/[^A-Za-z0-9_-]/g, ""), "plat-wall"];
  if (query.year !== null) parts.push(String(query.year));
  if (query.platform !== "all") parts.push(query.platform);
  return `${parts.join("-")}.png`;
}
