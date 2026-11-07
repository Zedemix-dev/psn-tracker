import { ProfileBand } from "@/components/ProfileBand";
import { StatTiles } from "@/components/StatTiles";
import { requireSession } from "@/src/auth/require-session";
import { getDb } from "@/src/db/client";
import { profile } from "@/src/db/schema";
import { getSettings } from "@/src/settings/repo";
import { getProfileStats } from "@/src/stats/profile-stats";
import { loadImageMap } from "@/src/sync/images";
import { getSyncStatus } from "@/src/sync/requests";

export default async function Home() {
  await requireSession();
  const db = await getDb();
  const { hideZero } = await getSettings(db);
  const [[row], stats, imageMap, sync] = await Promise.all([
    db.select().from(profile).limit(1),
    getProfileStats(db, { hideZero }),
    loadImageMap(db),
    getSyncStatus(db),
  ]);
  return (
    <main className="wrap">
      <ProfileBand profile={row} imageMap={imageMap} sync={sync} />
      <StatTiles stats={stats} />
      {/* Later tasks: latest-trophies carousel, games list and sidebar go below. */}
    </main>
  );
}
