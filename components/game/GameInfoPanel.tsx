import { Cup } from "@/components/ProgressStack";
import { RarityBreakdown } from "@/components/RarityBreakdown";
import type { TrophyType } from "@/src/db/schema";
import type { GameDetail } from "@/src/games/detail";
import { formatInt } from "@/src/lib/format";

const TYPES: TrophyType[] = ["platinum", "gold", "silver", "bronze"];

function Chips({ counts, index }: { counts: GameDetail["counts"]; index: 0 | 1 }) {
  return (
    <div className="chips">
      {TYPES.filter((t) => counts[t][1] > 0).map((t) => (
        <span key={t} className={`chip ${t}`} title={t}>
          <Cup />
          {counts[t][index]}
        </span>
      ))}
    </div>
  );
}

function ExtIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="11"
      height="11"
      aria-hidden="true"
      style={{ display: "inline", verticalAlign: "-1px" }}
    >
      <path
        d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GameInfoPanel({ detail }: { detail: GameDetail }) {
  const { rarity } = detail;
  return (
    <section className="panel glass" aria-label="Game info">
      <div className="block">
        <div className="totals">
          <span className="lbl">Total</span>
          <span className="val">
            {detail.definedTotal} trophies <span>· {formatInt(detail.points.total)} points</span>
          </span>
          <Chips counts={detail.counts} index={1} />
          <span className="lbl">Earned</span>
          <span className="val">
            {detail.earnedTotal} trophies <span>· {formatInt(detail.points.earned)} points</span>
          </span>
          <Chips counts={detail.counts} index={0} />
        </div>
      </div>
      <div className="block">
        <RarityBreakdown breakdown={detail.breakdown} />
      </div>
      <div className="block">
        <dl className="kv">
          {detail.publisher && (
            <div>
              <dt>Publisher</dt>
              <dd>{detail.publisher}</dd>
            </div>
          )}
          {detail.genres && (
            <div>
              <dt>Genre</dt>
              <dd>{detail.genres}</dd>
            </div>
          )}
          {detail.releaseDate && (
            <div>
              <dt>Release date</dt>
              <dd>{detail.releaseDate}</dd>
            </div>
          )}
          {rarity && (
            <div>
              <dt>Avg. rarity</dt>
              <dd>
                {rarity.average}
                <small className="spread">
                  <span title="Lowest">{rarity.lowest}</span> · <span title="Median">{rarity.median}</span> ·{" "}
                  <span title="Highest">{rarity.highest}</span>
                </small>
              </dd>
            </div>
          )}
          <div>
            <dt>Guides</dt>
            <dd>
              <a href={detail.guides.powerPyx} target="_blank" rel="noopener noreferrer">
                PowerPyx roadmap <ExtIcon />
              </a>
              <br />
              <a href={detail.guides.psnProfiles} target="_blank" rel="noopener noreferrer">
                PSNProfiles guides <ExtIcon />
              </a>
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
