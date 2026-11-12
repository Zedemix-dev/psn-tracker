import { ProfileBand } from "@/components/ProfileBand";
import { StatTiles } from "@/components/StatTiles";
import { StatsPanels } from "@/components/stats/StatsPanels";
import { requireSession } from "@/src/auth/require-session";
import { getDb } from "@/src/db/client";
import { profile } from "@/src/db/schema";
import { getSettings } from "@/src/settings/repo";
import { getStatsData } from "@/src/stats/load";
import { getProfileStats } from "@/src/stats/profile-stats";
import { loadImageMap } from "@/src/sync/images";
import { getSyncStatus } from "@/src/sync/requests";

export default async function StatsPage() {
  await requireSession();
  const db = await getDb();
  const { hideZero } = await getSettings(db);
  const imageMap = await loadImageMap(db); // read once, then handed to getStatsData
  const [[row], stats, sync, data] = await Promise.all([
    db.select().from(profile).limit(1),
    getProfileStats(db, { hideZero }),
    getSyncStatus(db),
    getStatsData(db, { hideZero, imageMap }),
  ]);
  return (
    <main className="wrap">
      <ProfileBand profile={row} imageMap={imageMap} sync={sync} />
      <StatTiles stats={stats} />
      <StatsPanels data={data} />
    </main>
  );
}
