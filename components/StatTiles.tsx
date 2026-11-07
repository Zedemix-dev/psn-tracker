import { formatHoursTotal, formatInt, formatPercent } from "@/src/lib/format";
import type { ProfileStats } from "@/src/stats/profile-stats";

export function StatTiles({ stats }: { stats: ProfileStats }) {
  const tiles = [
    { label: "Games completed", value: <>{formatInt(stats.gamesCompleted)} <small>/ {formatInt(stats.totalGames)}</small></> },
    { label: "Completion rate", value: formatPercent(stats.completionRate) },
    { label: "Average rarity", value: formatPercent(stats.averageRarity) },
    { label: "Unearned trophies", value: formatInt(stats.unearned) },
    { label: "Trophies per day", value: stats.trophiesPerDay.toFixed(2) },
    { label: "Hours played", value: formatHoursTotal(stats.hoursSeconds) },
  ];
  return (
    <section className="stats" aria-label="Key stats">
      {tiles.map((t) => (
        <div key={t.label} className="stat glass">
          <div className="label">{t.label}</div>
          <div className="value">{t.value}</div>
        </div>
      ))}
    </section>
  );
}
