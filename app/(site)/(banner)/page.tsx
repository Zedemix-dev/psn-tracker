import { GameFilters } from "@/components/GameFilters";
import { GameList } from "@/components/GameList";
import { SHOW_ALL_SLOT_ID } from "@/components/game-query-string";
import { HideZeroToggle } from "@/components/HideZeroToggle";
import { CabinetPanel } from "@/components/CabinetPanel";
import { MilestonesPanel } from "@/components/MilestonesPanel";
import { RarestPanel } from "@/components/RarestPanel";
import { ProfileBand } from "@/components/ProfileBand";
import { StatTiles } from "@/components/StatTiles";
import { TrophyCarousel, type CarouselTrophy } from "@/components/TrophyCarousel";
import { requireSession } from "@/src/auth/require-session";
import { toTrophyItem } from "@/src/cabinet/item";
import { getCabinet } from "@/src/cabinet/repo";
import { getDb } from "@/src/db/client";
import { profile } from "@/src/db/schema";
import { parseGameQuery, queryGames } from "@/src/games/query";
import { formatDateTime, formatInt, formatPercent } from "@/src/lib/format";
import { rarityTier } from "@/src/lib/rarity";
import { getSettings } from "@/src/settings/repo";
import { getProfileStats } from "@/src/stats/profile-stats";
import { getMilestones } from "@/src/stats/milestones";
import { getLatestTrophies, getRarest, getRarityBreakdown } from "@/src/stats/trophies";
import { loadImageMap, mediaSrc } from "@/src/sync/images";
import { getSyncStatus } from "@/src/sync/requests";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function Home({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireSession();
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) params.set(key, first);
  }
  // The first page always starts at 0; further pages come from /api/games.
  const query = { ...parseGameQuery(params), offset: 0 };
  const db = await getDb();
  const { hideZero } = await getSettings(db);
  const now = new Date();
  const [[row], stats, imageMap, sync, latest, games, cabinet, rarest, breakdown, milestones] = await Promise.all([
    db.select().from(profile).limit(1),
    getProfileStats(db, { hideZero }),
    loadImageMap(db),
    getSyncStatus(db),
    getLatestTrophies(db, 20),
    queryGames(db, query, { hideZero }),
    getCabinet(db),
    getRarest(db, 5),
    getRarityBreakdown(db),
    getMilestones(db, now),
  ]);
  // JSON-safe for the client component: no Date crosses the boundary.
  const carousel: CarouselTrophy[] = latest.map((t) => ({
    key: `${t.titleId}-${t.trophyId}`,
    name: t.name,
    detail: t.detail,
    game: t.gameName,
    when: formatDateTime(t.earnedAt),
    iconSrc: mediaSrc(t.iconUrl, imageMap),
    type: t.type,
    ratePct: t.earnedRate === null ? null : formatPercent(t.earnedRate),
    tier: t.earnedRate === null ? null : rarityTier(t.earnedRate),
  }));
  const listKey = `${hideZero}|${query.state}|${query.platform}|${query.sort}|${query.q}|${query.unobtainable}|${sync.lastSuccessAt}`;
  return (
    <main className="wrap">
      <ProfileBand profile={row} imageMap={imageMap} sync={sync} />
      <StatTiles stats={stats} />
      <TrophyCarousel trophies={carousel} />
      <div className="layout">
        <section className="panel glass" aria-label="Games">
          <div className="panel-head">
            <div className="ph-left">
              <h2>Games</h2>
              <HideZeroToggle checked={hideZero} />
            </div>
            <div className="head-right">
              <span id={SHOW_ALL_SLOT_ID} />
              <span className="aside">
                {formatInt(games.total)} {games.total === 1 ? "game" : "games"}
              </span>
            </div>
          </div>
          <GameFilters query={query} />
          {/* lastSuccessAt in the key: after a sync, the list restarts from the fresh first page. */}
          <GameList
            key={listKey}
            snapshotKey={listKey}
            initial={games}
            query={query}
            empty={
              hideZero && query.state === "0"
                ? "0% games are hidden. Turn off “Hide 0% games” to see them."
                : "No games match these filters."
            }
          />
        </section>
        <aside className="side">
          <CabinetPanel items={cabinet.map((t) => toTrophyItem(t, imageMap))} />
          <RarestPanel items={rarest.map((t) => toTrophyItem(t, imageMap))} breakdown={breakdown} />
          <MilestonesPanel
            rows={milestones.map((milestone) => ({
              milestone,
              iconSrc: mediaSrc(milestone.trophy.iconUrl, imageMap),
            }))}
            now={now}
          />
        </aside>
      </div>
    </main>
  );
}
