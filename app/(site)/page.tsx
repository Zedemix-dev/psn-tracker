import { ProfileBand } from "@/components/ProfileBand";
import { StatTiles } from "@/components/StatTiles";
import { TrophyCarousel, type CarouselTrophy } from "@/components/TrophyCarousel";
import { requireSession } from "@/src/auth/require-session";
import { getDb } from "@/src/db/client";
import { profile } from "@/src/db/schema";
import { formatDateTime, formatPercent } from "@/src/lib/format";
import { rarityTier } from "@/src/lib/rarity";
import { getSettings } from "@/src/settings/repo";
import { getProfileStats } from "@/src/stats/profile-stats";
import { getLatestTrophies } from "@/src/stats/trophies";
import { loadImageMap, mediaSrc } from "@/src/sync/images";
import { getSyncStatus } from "@/src/sync/requests";

export default async function Home() {
  await requireSession();
  const db = await getDb();
  const { hideZero } = await getSettings(db);
  const [[row], stats, imageMap, sync, latest] = await Promise.all([
    db.select().from(profile).limit(1),
    getProfileStats(db, { hideZero }),
    loadImageMap(db),
    getSyncStatus(db),
    getLatestTrophies(db, 20),
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
  return (
    <main className="wrap">
      <ProfileBand profile={row} imageMap={imageMap} sync={sync} />
      <StatTiles stats={stats} />
      <TrophyCarousel trophies={carousel} />
      {/* Later tasks: games list and sidebar go below. */}
    </main>
  );
}
