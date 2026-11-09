import { PlatWallControls } from "@/components/plat-wall/PlatWallControls";
import { PlatGrid, type PlatTile } from "@/components/plat-wall/PlatGrid";
import { ProfileBand } from "@/components/ProfileBand";
import { StatTiles } from "@/components/StatTiles";
import { requireSession } from "@/src/auth/require-session";
import { getDb } from "@/src/db/client";
import { profile } from "@/src/db/schema";
import { formatDate, formatInt, formatPercent } from "@/src/lib/format";
import { loadPlatinums } from "@/src/plat-wall/load";
import { applyPlatQuery, parsePlatQuery, platinumYears } from "@/src/plat-wall/query";
import { getSettings } from "@/src/settings/repo";
import { getProfileStats } from "@/src/stats/profile-stats";
import { loadImageMap, mediaSrc } from "@/src/sync/images";
import { getSyncStatus } from "@/src/sync/requests";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function PlatWallPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireSession();
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) params.set(key, first);
  }
  const query = parsePlatQuery(params);
  const db = await getDb();
  const { hideZero } = await getSettings(db);
  const [[row], stats, imageMap, sync, all] = await Promise.all([
    db.select().from(profile).limit(1),
    getProfileStats(db, { hideZero }),
    loadImageMap(db),
    getSyncStatus(db),
    loadPlatinums(db),
  ]);
  const shown = applyPlatQuery(all, query);
  // JSON-safe for the client component: nothing but strings.
  const tiles: PlatTile[] = shown.map((p) => ({
    key: p.titleId,
    href: `/games/${encodeURIComponent(p.titleId)}`,
    src: mediaSrc(p.iconUrl, imageMap),
    game: p.game,
    when: formatDate(p.earnedAt),
    ratePct: p.rate === null ? null : formatPercent(p.rate),
  }));
  const name = row.onlineId ?? "PSN profile";
  return (
    <main className="wrap">
      <ProfileBand profile={row} imageMap={imageMap} sync={sync} />
      <StatTiles stats={stats} />
      <section className="panel glass wall-panel" aria-label="Plat Wall">
        <div className="wall-head">
          <div>
            <h2>{name}&apos;s Plat Wall</h2>
            <div className="shown">
              Showing {formatInt(shown.length)} of {formatInt(all.length)} platinum trophies
            </div>
          </div>
          <PlatWallControls query={query} years={platinumYears(all)} />
        </div>
        {tiles.length > 0 ? (
          <PlatGrid tiles={tiles} show={query.show} />
        ) : (
          <div className="empty">No platinum trophies match these filters.</div>
        )}
      </section>
    </main>
  );
}
