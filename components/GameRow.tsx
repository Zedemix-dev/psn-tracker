import Link from "next/link";
import { ProgressStack, StatusIcon } from "@/components/ProgressStack";
import { TileImage } from "@/components/TileImage";
import type { GameRowData } from "@/src/games/row";

export function GameRow({ row }: { row: GameRowData }) {
  const played = row.lastPlayedLine ? row.lastPlayedLine.split(" | ") : [];
  return (
    <Link href={`/games/${encodeURIComponent(row.id)}`} className="game">
      <TileImage
        tile={row.coverIsIcon}
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
      <ProgressStack counts={row.counts} progress={row.progress} rank={row.rank} />
      <div className="status">
        <StatusIcon status={row.status} />
      </div>
    </Link>
  );
}
