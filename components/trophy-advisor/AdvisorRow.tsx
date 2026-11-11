import Link from "next/link";
import { TileImage } from "@/components/TileImage";
import { TrophyTypeIcon } from "@/components/TrophyTypeIcon";
import { UnobtainableMark } from "@/components/UnobtainableMark";
import type { AdvisorRow as AdvisorRowData } from "@/src/trophy-advisor/load";

export function AdvisorRow({ row }: { row: AdvisorRowData }) {
  const href = `/games/${encodeURIComponent(row.gameId)}`;
  return (
    <div className={`log-row adv-row${row.unobtainable ? " lost" : ""}`} data-key={row.key}>
      <Link href={href} prefetch={false} className="gl">
        {row.gameIsIcon ? (
          <TileImage tile className="gc icon" src={row.gameSrc} alt={row.gameName} loading="lazy" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="gc" src={row.gameSrc} alt={row.gameName} loading="lazy" />
        )}
      </Link>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="ic" src={row.iconSrc} alt="" loading="lazy" />
      <div>
        <div className="n">
          {row.name}
          {row.unobtainable && (
            <UnobtainableMark focusable label="No longer obtainable." detail={row.unobtainableNote} />
          )}
        </div>
        <div className="d">{row.detail}</div>
        <div className="g">
          <Link href={href} prefetch={false}>{row.gameName}</Link>
          {row.dlc && <span className="dlc">· {row.dlc}</span>}
          {row.platforms.map((p) => (
            <span key={p} className="platform">
              {p}
            </span>
          ))}
        </div>
      </div>
      <div className="meta">
        <div className="adv-count" title={row.counter ? "Progress" : undefined}>
          {row.counter}
        </div>
        <div className="rate">
          {row.ratePct && (
            <>
              <b>{row.ratePct}</b>
              {row.tier}
            </>
          )}
        </div>
      </div>
      <TrophyTypeIcon type={row.type} size={30} className="ti" />
    </div>
  );
}
