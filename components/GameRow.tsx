import Link from "next/link";
import { TrophyTypeIcon } from "@/components/TrophyTypeIcon";
import type { TrophyType } from "@/src/db/schema";
import type { GameRowData } from "@/src/games/row";

const TYPES: TrophyType[] = ["platinum", "gold", "silver", "bronze"];

function Cup() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 3h10v5a5 5 0 0 1-4 4.9V17h3v3H8v-3h3v-4.1A5 5 0 0 1 7 8V3zM4 5h2v3.4A3 3 0 0 1 4 5.6V5zm14 0h2v.6a3 3 0 0 1-2 2.8V5z"
      />
    </svg>
  );
}

function Check({ done }: { done: boolean }) {
  return (
    <svg
      className={`check${done ? "" : " miss"}`}
      viewBox="0 0 24 24"
      role="img"
      aria-label={done ? "Completed" : "Not completed"}
    >
      <path
        d="M5 12.5l4.5 4.5L19 7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Status({ status }: { status: GameRowData["status"] }) {
  switch (status) {
    case "plat-earned":
      return <TrophyTypeIcon type="platinum" size={28} className="pi" />;
    case "plat-missing":
      return <TrophyTypeIcon type="platinum" size={28} className="pi miss" />;
    case "complete":
      return <Check done />;
    case "incomplete":
      return <Check done={false} />;
  }
}

export function GameRow({ row }: { row: GameRowData }) {
  const played = row.lastPlayedLine ? row.lastPlayedLine.split(" | ") : [];
  return (
    <Link href={`/games/${encodeURIComponent(row.id)}`} className="game">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={`game-cover${row.coverIsIcon ? " icon" : ""}`}
        src={row.coverSrc}
        alt=""
        loading="lazy"
      />
      <div className="gtext">
        <div className="gtitle">
          <h3>{row.name}</h3>
          {row.platforms.map((p) => (
            <span key={p} className="platform">
              {p}
            </span>
          ))}
        </div>
        <div className="game-meta">
          <span>
            {row.earnedTotal} / {row.definedTotal} trophies
          </span>
        </div>
        {played.length > 0 && (
          <div className="game-meta">
            {played.map((part, i) => (
              <span key={i} style={{ display: "contents" }}>
                {i > 0 && <span className="sep" aria-hidden="true" />}
                <span>{part}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="right">
        <div className="chips">
          {TYPES.filter((t) => row.counts[t][1] > 0).map((t) => (
            <span key={t} className={`chip ${t}`} title={t}>
              <Cup />
              {row.counts[t][0]}/{row.counts[t][1]}
            </span>
          ))}
        </div>
        <div className="progress">
          <div className={`bar${row.progress === 0 ? " zero" : ""}`}>
            <i style={{ width: `${row.progress}%`, background: `var(--rank-${row.rank.toLowerCase()})` }} />
          </div>
          <span className="pct">{row.progress}%</span>
        </div>
      </div>
      <div className="status">
        <Status status={row.status} />
      </div>
    </Link>
  );
}
