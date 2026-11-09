import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Banner, PageBackground, bannerVars } from "@/components/Banner";
import { GameBand } from "@/components/game/GameBand";
import { GameInfoPanel } from "@/components/game/GameInfoPanel";
import { TimelinePanel } from "@/components/game/TimelinePanel";
import { TrophyList } from "@/components/game/TrophyList";
import { TileImage } from "@/components/TileImage";
import { requireSession } from "@/src/auth/require-session";
import { getDb } from "@/src/db/client";
import { getGameDetail } from "@/src/games/detail";
import { parseTrophyView } from "@/src/games/trophy-view";
import { loadImageMap } from "@/src/sync/images";
import { getSyncStatus } from "@/src/sync/requests";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function GamePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  await requireSession();
  const { id } = await params;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) query.set(key, first);
  }
  const db = await getDb();
  const detail = await getGameDetail(db, id, await loadImageMap(db), new Date());
  if (!detail) notFound();
  const hasImage = detail.bannerPath !== null;
  const sync = await getSyncStatus(db);
  const vars = hasImage ? bannerVars(detail.bannerPath, detail.bannerIsOverride ? 50 : 25) : bannerVars(null, 50);
  const view = parseTrophyView(query);

  return (
    <div className="game-page" style={vars as CSSProperties}>
      {hasImage && <PageBackground />}
      <Banner
        hasImage={hasImage}
        settingsLink={false}
        label={detail.name}
        logo={hasImage && detail.logoSrc ? { src: detail.logoSrc, alt: `${detail.name} logo` } : null}
      />
      <main className="wrap">
        <AutoRefresh active={sync.status === "queued" || sync.status === "running"} />
        <GameBand detail={detail} />
        <div className="layout">
          <TrophyList
            groups={detail.groups}
            trophies={detail.trophies}
            unobtainable={detail.unobtainable}
            initialShow={view.show}
            initialSort={view.sort}
          />
          <aside className="side">
            <section className="panel glass" aria-label="Cover">
              <TileImage
                tile={detail.coverIsIcon}
                className={`cover${detail.coverIsIcon ? " icon" : ""}`}
                src={detail.coverSrc}
                alt={`${detail.name} cover`}
              />
            </section>
            <GameInfoPanel detail={detail} />
            <TimelinePanel rows={detail.timeline} />
          </aside>
        </div>
      </main>
    </div>
  );
}
