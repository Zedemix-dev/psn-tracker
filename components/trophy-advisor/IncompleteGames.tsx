import Link from "next/link";
import { TileImage } from "@/components/TileImage";
import { UnobtainableMark } from "@/components/UnobtainableMark";
import { formatInt } from "@/src/lib/format";
import type { IncompleteGame } from "@/src/trophy-advisor/load";

/** The panel head and the list of the column; the page puts it in the aside. */
export function IncompleteGames({ games }: { games: IncompleteGame[] }) {
  return (
    <>
      <div className="adv-side-head">
        <h2>Incomplete games</h2>
        <span>
          {formatInt(games.length)} {games.length === 1 ? "game" : "games"}
        </span>
      </div>
      {games.length === 0 ? (
        <div className="adv-empty">No incomplete games.</div>
      ) : (
        <div className="adv-games">
          {games.map((g) => (
            <Link key={g.id} href={`/games/${encodeURIComponent(g.id)}`} prefetch={false} className="adv-game">
              {g.coverIsIcon ? (
                <TileImage tile bg={g.coverTileBg} className="icon" src={g.coverSrc} alt="" loading="lazy" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- images are already cached and sized by the app, no next/image optimizer wanted
                <img src={g.coverSrc} alt="" loading="lazy" />
              )}
              <div>
                <div className="t">
                  {g.name}
                  {g.platforms.map((p) => (
                    <span key={p} className="platform">
                      {p}
                    </span>
                  ))}
                  {g.unobtainable && <UnobtainableMark label={g.unobtainable.label} detail={g.unobtainable.note} />}
                </div>
                <div className="s">
                  <span className={`bar${g.progress === 0 ? " zero" : ""}`}>
                    <i style={{ width: `${g.progress}%`, background: `var(--rank-${g.rank.toLowerCase()})` }} />
                  </span>
                  <span className="pct">{g.progress}%</span>
                </div>
              </div>
              <div className="left">
                <b>{formatInt(g.left)}</b>{" "}left
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
