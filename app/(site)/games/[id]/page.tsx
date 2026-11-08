import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Banner, PageBackground, bannerVars } from "@/components/Banner";
import { GameBand } from "@/components/game/GameBand";
import { GameInfoPanel } from "@/components/game/GameInfoPanel";
import { TimelinePanel } from "@/components/game/TimelinePanel";
import { TrophyList } from "@/components/game/TrophyList";
import { requireSession } from "@/src/auth/require-session";
import { getDb } from "@/src/db/client";
import { getGameDetail } from "@/src/games/detail";
import { parseTrophyView } from "@/src/games/trophy-view";
import { getPageBanner } from "@/src/settings/page-banner";
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
  const hasOwnBanner = detail.bannerPath !== null;
  const [sync, pageBanner] = await Promise.all([
    getSyncStatus(db),
    hasOwnBanner ? Promise.resolve(null) : getPageBanner(db),
  ]);
  const vars = hasOwnBanner
    ? bannerVars(detail.bannerPath, 25)
    : bannerVars(pageBanner?.path ?? null, pageBanner?.posY ?? 50);
  const hasImage = hasOwnBanner || pageBanner !== null;
  const view = parseTrophyView(query);

  return (
    <div className="game-page" style={vars as CSSProperties}>
      {hasImage && <PageBackground />}
      <Banner
        hasImage={hasImage}
        label={detail.name}
        logo={hasOwnBanner && detail.logoSrc ? { src: detail.logoSrc, alt: `${detail.name} logo` } : null}
      />
      <main className="wrap">
        <AutoRefresh active={sync.status === "queued" || sync.status === "running"} />
        <GameBand detail={detail} />
        <div className="layout">
          <TrophyList
            groups={detail.groups}
            trophies={detail.trophies}
            initialShow={view.show}
            initialSort={view.sort}
          />
          <aside className="side">
            <section className="panel glass" aria-label="Cover">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
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
