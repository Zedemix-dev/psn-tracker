"use client";

import Link from "next/link";
import { useEffect, useState, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import type { PlatShow } from "@/src/plat-wall/query";

/** JSON-safe: nothing but strings crosses to the client. */
export type PlatTile = {
  key: string;
  href: string;
  src: string;
  game: string;
  when: string;
  ratePct: string | null;
};

const TIP_WIDTH = 220;
const MARGIN = 8;
const GAP = 7;
const MIN_ROOM_ABOVE = 90;

type Tip = { tile: PlatTile; left: number; top?: number; bottom?: number };

function placeTip(tile: PlatTile, rect: DOMRect): Tip {
  const centered = rect.left + rect.width / 2 - TIP_WIDTH / 2;
  const left = Math.max(MARGIN, Math.min(centered, window.innerWidth - TIP_WIDTH - MARGIN));
  if (rect.top < MIN_ROOM_ABOVE) return { tile, left, top: rect.bottom + GAP };
  return { tile, left, bottom: window.innerHeight - rect.top + GAP };
}

export function PlatGrid({ tiles, show }: { tiles: PlatTile[]; show: PlatShow[] }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const art = show.includes("art");
  const byKey = new Map(tiles.map((t) => [t.key, t]));

  useEffect(() => {
    if (!tip) return;
    const hide = () => setTip(null);
    window.addEventListener("scroll", hide, { passive: true });
    return () => window.removeEventListener("scroll", hide);
  }, [tip]);

  const open = (e: SyntheticEvent<HTMLElement>) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("a.plat-tile");
    const tile = el?.dataset.key ? byKey.get(el.dataset.key) : undefined;
    if (el && tile) setTip(placeTip(tile, el.getBoundingClientRect()));
  };
  const close = () => setTip(null);

  return (
    <div className="plat-grid" onMouseOver={open} onFocus={open} onMouseOut={close} onBlur={close}>
      {tiles.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          prefetch={false}
          data-key={t.key}
          className={`plat-tile${art ? "" : " textonly"}`}
          aria-label={`${t.game}, earned ${t.when}${t.ratePct ? `, ${t.ratePct} of players` : ""}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {art && <img className="art" src={t.src} alt="" loading="lazy" />}
          {show.includes("rarity") && t.ratePct && <div className="pct">{t.ratePct}</div>}
          {show.includes("name") && <div className="nm">{t.game}</div>}
        </Link>
      ))}
      {tip &&
        createPortal(
          <div
            role="tooltip"
            className="plat-tip"
            style={{ left: tip.left, top: tip.top, bottom: tip.bottom, width: TIP_WIDTH }}
          >
            <b>{tip.tile.game}</b>
            <span>Earned {tip.tile.when}</span>
            {tip.tile.ratePct && <span>{tip.tile.ratePct} of players</span>}
          </div>,
          document.body,
        )}
    </div>
  );
}
