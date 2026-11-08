import { ProgressStack, StatusIcon } from "@/components/ProgressStack";
import type { GameDetail } from "@/src/games/detail";

export function GameBand({ detail }: { detail: GameDetail }) {
  return (
    <section className="gband glass" aria-label="Game">
      <div>
        <div className="gtitle">
          <h1>{detail.name}</h1>
          {detail.platforms.map((p) => (
            <span key={p} className="platform">
              {p}
            </span>
          ))}
        </div>
        <div className="gmeta">
          {detail.metaParts.map((part, i) => (
            <span key={i} style={{ display: "contents" }}>
              {i > 0 && <span className="sep" aria-hidden="true" />}
              <span>{part}</span>
            </span>
          ))}
        </div>
      </div>
      <ProgressStack counts={detail.counts} progress={detail.progress} rank={detail.rank} />
      <div className="status">
        <StatusIcon status={detail.status} size={32} />
      </div>
    </section>
  );
}
