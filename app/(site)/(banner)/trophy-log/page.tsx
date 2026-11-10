import { ProfileBand } from "@/components/ProfileBand";
import { StatTiles } from "@/components/StatTiles";
import { TrophyLogControls } from "@/components/trophy-log/TrophyLogControls";
import { TrophyLogRow } from "@/components/trophy-log/TrophyLogRow";
import { requireSession } from "@/src/auth/require-session";
import { getDb } from "@/src/db/client";
import { profile } from "@/src/db/schema";
import { getSettings } from "@/src/settings/repo";
import { getProfileStats } from "@/src/stats/profile-stats";
import { loadImageMap } from "@/src/sync/images";
import { getSyncStatus } from "@/src/sync/requests";
import { countLoggedTrophies, queryTrophyLog } from "@/src/trophy-log/load";
import { isFiltered, LOG_PAGE_SIZE, LOG_SHOW_ALL_SLOT_ID, parseLogQuery, shownText } from "@/src/trophy-log/query";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function TrophyLogPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireSession();
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) params.set(key, first);
  }
  const query = parseLogQuery(params);
  const db = await getDb();
  const { hideZero } = await getSettings(db);
  const [[row], stats, imageMap, sync, log, overall] = await Promise.all([
    db.select().from(profile).limit(1),
    getProfileStats(db, { hideZero }),
    loadImageMap(db),
    getSyncStatus(db),
    queryTrophyLog(db, query, { offset: 0, limit: LOG_PAGE_SIZE }),
    countLoggedTrophies(db),
  ]);
  const name = row.onlineId ?? "PSN profile";
  return (
    <main className="wrap">
      <ProfileBand profile={row} imageMap={imageMap} sync={sync} />
      <StatTiles stats={stats} />
      <section className="panel glass log-panel" aria-label="Trophy Log">
        <div className="log-head">
          <h2>{name}&apos;s Trophy Log</h2>
          <div className="log-aside">
            <span id={LOG_SHOW_ALL_SLOT_ID} />
            <span>{shownText(overall, log.total, isFiltered(query))}</span>
          </div>
        </div>
        <TrophyLogControls query={query} />
        {log.items.length > 0 ? (
          log.items.map((item) => <TrophyLogRow key={item.key} row={item} />)
        ) : (
          <p className="empty">{overall === 0 ? "No trophies earned yet." : "No trophies match these filters."}</p>
        )}
      </section>
    </main>
  );
}
