import { formatDateTimeSeconds, formatInt, formatRelative } from "@/src/lib/format";
import type { Milestone } from "@/src/stats/milestones";

/** `iconSrc` is resolved on the server so this stays a plain server component. */
export type MilestoneRow = { milestone: Milestone; iconSrc: string };

export function MilestonesPanel({ rows, now }: { rows: MilestoneRow[]; now: Date }) {
  return (
    <section className="panel glass" aria-label="Milestones">
      <div className="panel-head">
        <h2>Milestones</h2>
        <span className="aside">{formatInt(rows.length)} milestones</span>
      </div>
      <ul className="tlist">
        {rows.map(({ milestone: { label, trophy }, iconSrc }) => (
          <li key={`${label}|${trophy.titleId}|${trophy.trophyId}`} title={trophy.name}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={iconSrc} alt="" loading="lazy" />
            <div>
              <div className="n">{trophy.name}</div>
              <div className="g">{trophy.gameName}</div>
            </div>
            <div className="r">
              <span className="m">{label}</span>
              <br />
              <span title={formatDateTimeSeconds(trophy.earnedAt)}>{formatRelative(trophy.earnedAt, now)}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
