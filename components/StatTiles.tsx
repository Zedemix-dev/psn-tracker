import type { ProfileStats } from "@/src/stats/profile-stats";
import { statTileValues } from "@/src/stats/stat-tile-values";

export function StatTiles({ stats }: { stats: ProfileStats }) {
  return (
    <section className="stats" aria-label="Key stats">
      {statTileValues(stats).map((t) => (
        <div key={t.label} className="stat glass">
          <div className="label">{t.label}</div>
          <div className="value">
            {t.value}
            {t.suffix && <> <small>{t.suffix}</small></>}
          </div>
        </div>
      ))}
    </section>
  );
}
