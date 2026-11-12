"use client";

import { Fragment, useState } from "react";
import { ProgressStack, StatusIcon } from "@/components/ProgressStack";
import { TileImage } from "@/components/TileImage";
import { UnobtainableMark } from "@/components/UnobtainableMark";
import { TrophyTypeIcon } from "@/components/TrophyTypeIcon";
import type { GroupData, TrophyRowData, UnobtainableBand } from "@/src/games/detail";
import {
  filterAndSort,
  trophyViewParams,
  type TrophyShow,
  type TrophySort,
} from "@/src/games/trophy-view";

function Row({ t }: { t: TrophyRowData }) {
  return (
    <div className={`trophy${t.earned ? " earned" : t.unobtainable ? " lost" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- images are already cached and sized by the app, no next/image optimizer wanted */}
      <img className="ic" src={t.iconSrc} alt="" loading="lazy" />
      <div>
        <div className="n">
          {t.name}
          {t.unobtainable && (
            <UnobtainableMark
              focusable
              label="No longer obtainable."
              detail={t.earned ? "You already have it." : null}
            />
          )}
        </div>
        <div className="d">{t.detail}</div>
      </div>
      <div className="meta">
        <div className="when">
          {t.earned && t.earnedDate ? (
            <>
              {t.earnedDate}
              <small>{t.earnedTime}</small>
            </>
          ) : t.counter ? (
            <span className="tcount" title="Progress">
              {t.counter}
            </span>
          ) : null}
        </div>
        <div className="rate">
          {t.rateLabel && (
            <>
              <b>{t.rateLabel}</b>
              {t.tier}
            </>
          )}
        </div>
      </div>
      <TrophyTypeIcon type={t.type} size={30} className="ti" />
    </div>
  );
}

export function TrophyList({
  groups,
  trophies,
  unobtainable,
  initialShow,
  initialSort,
}: {
  groups: GroupData[];
  trophies: TrophyRowData[];
  unobtainable: UnobtainableBand | null;
  initialShow: TrophyShow;
  initialSort: TrophySort;
}) {
  const [show, setShow] = useState<TrophyShow>(initialShow);
  const [sort, setSort] = useState<TrophySort>(initialSort);

  function update(next: { show: TrophyShow; sort: TrophySort }) {
    setShow(next.show);
    setSort(next.sort);
    const qs = trophyViewParams(next).toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }

  const multi = groups.length > 1;
  const earnedCount = trophies.filter((t) => t.earned).length;
  const sections = groups
    .map((g) => ({ g, rows: filterAndSort(trophies.filter((t) => t.groupId === g.id), show, sort) }))
    .filter((s) => s.rows.length > 0);

  return (
    <section className="panel glass trophies-panel" aria-label="Trophies">
      <div className="panel-head">
        <h2>Trophies</h2>
        <span className="aside">
          {earnedCount} of {trophies.length} earned
        </span>
      </div>
      <div className="tools">
        <select
          className="select"
          aria-label="Show"
          value={show}
          onChange={(e) => update({ show: e.target.value as TrophyShow, sort })}
        >
          <option value="all">All trophies</option>
          <option value="earned">Earned</option>
          <option value="unearned">Unearned</option>
        </select>
        <select
          className="select"
          aria-label="Sort by"
          value={sort}
          onChange={(e) => update({ show, sort: e.target.value as TrophySort })}
        >
          <option value="psn">PSN order</option>
          <option value="date">Date earned</option>
          <option value="rarity">Rarest first</option>
        </select>
      </div>
      {unobtainable && (
        <div className="unob-note">
          <i className="unob" aria-hidden="true">
            !
          </i>
          <div>
            <b>{unobtainable.label}</b>
            {unobtainable.situation}
            {unobtainable.note.length > 0 && (
              <div className="why">
                {unobtainable.note.map((s, i) =>
                  s.href ? (
                    <a key={i} href={s.href} target="_blank" rel="noopener noreferrer">
                      {s.text}
                    </a>
                  ) : (
                    <Fragment key={i}>{s.text}</Fragment>
                  ),
                )}
              </div>
            )}
          </div>
        </div>
      )}
      <div>
        {sections.length === 0 && <div className="empty-list">No trophy matches this filter.</div>}
        {sections.map(({ g, rows }) => (
          <Fragment key={g.id}>
            {multi && (
              <div className="group-head">
                <TileImage
                  tile={!g.iconIsCover}
                  bg={g.iconTileBg}
                  className={g.iconIsCover ? "sq" : undefined}
                  src={g.iconSrc}
                  alt=""
                  loading="lazy"
                />
                <div>
                  <div className="kicker">{g.kicker}</div>
                  <h3>{g.name}</h3>
                  <div className="sub">
                    {g.earned} of {g.total} trophies
                  </div>
                </div>
                <ProgressStack counts={g.counts} progress={g.progress} rank={g.rank} />
                <div className="status">
                  <StatusIcon status={g.status} />
                </div>
              </div>
            )}
            {rows.map((t) => (
              <Row key={t.id} t={t} />
            ))}
          </Fragment>
        ))}
      </div>
    </section>
  );
}
