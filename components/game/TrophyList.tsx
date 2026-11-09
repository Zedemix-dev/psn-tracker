"use client";

import { Fragment, useState } from "react";
import { ProgressStack, StatusIcon } from "@/components/ProgressStack";
import { TrophyTypeIcon } from "@/components/TrophyTypeIcon";
import type { GroupData, TrophyRowData } from "@/src/games/detail";
import {
  filterAndSort,
  trophyViewParams,
  type TrophyShow,
  type TrophySort,
} from "@/src/games/trophy-view";

function Row({ t }: { t: TrophyRowData }) {
  return (
    <div className={`trophy${t.earned ? " earned" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="ic" src={t.iconSrc} alt="" loading="lazy" />
      <div>
        <div className="n">{t.name}</div>
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
  initialShow,
  initialSort,
}: {
  groups: GroupData[];
  trophies: TrophyRowData[];
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
      <div>
        {sections.length === 0 && <div className="empty-list">No trophy matches this filter.</div>}
        {sections.map(({ g, rows }) => (
          <Fragment key={g.id}>
            {multi && (
              <div className="group-head">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className={g.iconIsCover ? "sq" : undefined} src={g.iconSrc} alt="" loading="lazy" />
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
