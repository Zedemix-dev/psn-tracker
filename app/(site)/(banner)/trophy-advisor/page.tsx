import { ProfileBand } from "@/components/ProfileBand";
import { StatTiles } from "@/components/StatTiles";
import { AdvisorControls } from "@/components/trophy-advisor/AdvisorControls";
import { AdvisorList } from "@/components/trophy-advisor/AdvisorList";
import { AdvisorToggles } from "@/components/trophy-advisor/AdvisorToggles";
import { IncompleteGames } from "@/components/trophy-advisor/IncompleteGames";
import { requireSession } from "@/src/auth/require-session";
import { getDb } from "@/src/db/client";
import { profile } from "@/src/db/schema";
import { getSettings } from "@/src/settings/repo";
import { getProfileStats } from "@/src/stats/profile-stats";
import { loadImageMap } from "@/src/sync/images";
import { getSyncStatus } from "@/src/sync/requests";
import { advisorScope, countAdvisorTrophies, getIncompleteGames, queryAdvisor } from "@/src/trophy-advisor/load";
import { ADVISOR_SHOW_ALL_SLOT_ID, advisorListKey, parseAdvisorQuery } from "@/src/trophy-advisor/query";
import { isFiltered, LOG_PAGE_SIZE, shownText } from "@/src/trophy-log/query";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function TrophyAdvisorPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireSession();
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) params.set(key, first);
  }
  const query = parseAdvisorQuery(params);
  const db = await getDb();
  const settings = await getSettings(db);
  const scope = advisorScope(settings);
  const [[row], stats, imageMap, sync, page, overall, games] = await Promise.all([
    db.select().from(profile).limit(1),
    getProfileStats(db, { hideZero: settings.hideZero }),
    loadImageMap(db),
    getSyncStatus(db),
    queryAdvisor(db, query, scope, { offset: 0, limit: LOG_PAGE_SIZE }),
    countAdvisorTrophies(db, scope),
    getIncompleteGames(db, scope),
  ]);
  const name = row.onlineId ?? "PSN profile";
  const listKey = advisorListKey(query, scope, sync.lastSuccessAt);
  return (
    <main className="wrap">
      <ProfileBand profile={row} imageMap={imageMap} sync={sync} />
      <StatTiles stats={stats} />
      <div className="layout adv-layout">
        <section className="panel glass log-panel adv-panel" aria-label="Trophy Advisor">
          <div className="log-head">
            <div className="adv-left">
              <h2>{name}&apos;s Trophy Advisor</h2>
              <AdvisorToggles hideUnobtainable={settings.advisorHideUnobtainable} dlc={settings.advisorDlc} />
            </div>
            <div className="log-aside">
              <span>{shownText(overall, page.total, isFiltered(query))}</span>
              <span id={ADVISOR_SHOW_ALL_SLOT_ID} />
            </div>
          </div>
          <AdvisorControls query={query} />
          <AdvisorList
            key={listKey}
            initial={page}
            query={query}
            snapshotKey={listKey}
            empty={overall === 0 ? "Nothing left to earn." : "No trophies match these filters."}
          />
        </section>
        <aside className="panel glass adv-side" aria-label="Incomplete games">
          <IncompleteGames games={games} />
        </aside>
      </div>
    </main>
  );
}
