import { TrophyTypeIcon } from "@/components/TrophyTypeIcon";
import type { TrophyType } from "@/src/db/schema";
import type { GameRank, GameStatus } from "@/src/games/row";

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

export function StatusIcon({ status, size = 28 }: { status: GameStatus; size?: number }) {
  switch (status) {
    case "plat-earned":
      return <TrophyTypeIcon type="platinum" size={size} className="pi" />;
    case "plat-missing":
      return <TrophyTypeIcon type="platinum" size={size} className="pi miss" />;
    case "complete":
      return <Check done />;
    case "incomplete":
      return <Check done={false} />;
  }
}

export function ProgressStack({
  counts,
  progress,
  rank,
}: {
  counts: Record<TrophyType, [number, number]>;
  progress: number;
  rank: GameRank;
}) {
  return (
    <div className="right">
      <div className="chips">
        {TYPES.filter((t) => counts[t][1] > 0).map((t) => (
          <span key={t} className={`chip ${t}`} title={t}>
            <Cup />
            {counts[t][0]}/{counts[t][1]}
          </span>
        ))}
      </div>
      <div className="progress">
        <div className={`bar${progress === 0 ? " zero" : ""}`}>
          <i style={{ width: `${progress}%`, background: `var(--rank-${rank.toLowerCase()})` }} />
        </div>
        <span className="pct">{progress}%</span>
      </div>
    </div>
  );
}
