import type { GameTitle } from "@/src/games/row";
import { withSiblings, type SiblingIndex } from "@/src/games/siblings";
import { parisYear } from "@/src/lib/format";
import { displayPublisher } from "./publisher-names";

export type GameCharts = {
  games: number;
  completion: { buckets: [number, number, number, number, number]; average: number }; // 80-100 first
  platforms: { PS5: number; PS4: number };
  years: { year: number; games: number }[]; // every year from first to last, 0 kept
  noYear: number;
  publishers: { name: string; games: number }[]; // the top 15
  otherPublishers: { names: number; games: number };
  noPublisher: number;
  genres: { name: string; games: number }[];
  noGenre: number;
};

const TOP_PUBLISHERS = 15;

/** Most games first, then alphabetical (spec 18.9). */
function ranked(counts: Map<string, number>): { name: string; games: number }[] {
  return [...counts]
    .map(([name, games]) => ({ name, games }))
    .sort((a, b) => b.games - a.games || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

const bump = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);

export function buildGameCharts(titles: GameTitle[], index: SiblingIndex): GameCharts {
  const buckets: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  const platforms = { PS5: 0, PS4: 0 };
  const perYear = new Map<number, number>();
  const publishers = new Map<string, number>();
  const genres = new Map<string, number>();
  let progressSum = 0;
  let noYear = 0;
  let noPublisher = 0;
  let noGenre = 0;

  for (const title of titles) {
    progressSum += title.progress;
    buckets[title.progress >= 80 ? 0 : title.progress >= 60 ? 1 : title.progress >= 40 ? 2 : title.progress >= 20 ? 3 : 4] += 1;
    // 18.6: a list that includes PS5 is PS5; every other list (PS4, PS3, Vita) is PS4.
    platforms[title.platforms.includes("PS5") ? "PS5" : "PS4"] += 1;

    const info = withSiblings(title, index);
    if (info.releaseDate) {
      const y = parisYear(info.releaseDate);
      perYear.set(y, (perYear.get(y) ?? 0) + 1);
    } else {
      noYear += 1;
    }
    if (info.publisher) bump(publishers, displayPublisher(info.publisher));
    else noPublisher += 1;
    if (info.genres && info.genres.length > 0) for (const g of new Set(info.genres)) bump(genres, g);
    else noGenre += 1;
  }

  const years: { year: number; games: number }[] = [];
  if (perYear.size > 0) {
    const all = [...perYear.keys()];
    for (let y = Math.min(...all); y <= Math.max(...all); y++) years.push({ year: y, games: perYear.get(y) ?? 0 });
  }

  const allPublishers = ranked(publishers);
  const rest = allPublishers.slice(TOP_PUBLISHERS);

  return {
    games: titles.length,
    completion: { buckets, average: titles.length ? Math.round((progressSum / titles.length) * 100) / 100 : 0 },
    platforms,
    years,
    noYear,
    publishers: allPublishers.slice(0, TOP_PUBLISHERS),
    otherPublishers: { names: rest.length, games: rest.reduce((s, p) => s + p.games, 0) },
    noPublisher,
    genres: ranked(genres),
    noGenre,
  };
}
