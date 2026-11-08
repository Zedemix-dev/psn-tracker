import type { TimelineRow } from "@/src/games/detail-stats";

export function TimelinePanel({ rows }: { rows: TimelineRow[] }) {
  return (
    <section className="panel glass" aria-label="Timeline">
      <div className="panel-head">
        <h2>Timeline</h2>
      </div>
      <ul className="dates">
        {rows.map((r) => (
          <li key={r.label}>
            <div>
              <div className="k">{r.label}</div>
              {r.note && <div className="s">{r.note}</div>}
            </div>
            <div className="v">
              {r.date}
              {r.time && <small>{r.time}</small>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
