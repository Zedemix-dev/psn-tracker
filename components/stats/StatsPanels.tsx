"use client";

import type { ReactNode } from "react";
import { formatInt } from "@/src/stats/chart-geometry";
import type { StatsData } from "@/src/stats/load";
import { BarList } from "./BarList";
import { ChartTipProvider } from "./ChartTip";
import { COMPLETION_COLORS, PLATFORM_COLORS, RARITY_COLORS, TYPE_COLORS } from "./colors";
import { ColumnChart } from "./ColumnChart";
import { DonutCard } from "./DonutCard";
import { LevelHistory } from "./LevelHistory";
import { StatsCalendar } from "./StatsCalendar";
import { MonthlyActivity, TrophyProgression } from "./TimeCharts";

const RARITY_LABELS = ["Ultra rare", "Very rare", "Rare", "Uncommon", "Common"] as const;
const COMPLETION_LABELS = ["80% – 100%", "60% – 79%", "40% – 59%", "20% – 39%", "0% – 19%"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));

function Panel({ title, aside, children }: { title: string; aside?: string; children: ReactNode }) {
  return (
    <section className="panel glass">
      <div className="st-head">
        <h2>{title}</h2>
        {aside && <div className="aside">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

const missing = (n: number, one: string, many: string) => (n === 0 ? null : `${n} ${n === 1 ? one : many}`);

export function StatsPanels({ data }: { data: StatsData }) {
  if (data.total === 0) {
    return <section className="panel glass st-empty">No trophies yet.</section>;
  }

  const noYear = missing(data.noYear, "game has no release date on PSN.", "games have no release date on PSN.");
  const noPublisher = missing(data.noPublisher, "game has no publisher on PSN.", "games have no publisher on PSN.");
  const publishers: { name: string; value: number; other?: boolean }[] = data.publishers.map((p) => ({ name: p.name, value: p.games }));
  if (data.otherPublishers.names > 0) {
    publishers.push({ name: `Other (${data.otherPublishers.names})`, value: data.otherPublishers.games, other: true });
  }

  return (
    <ChartTipProvider>
      <div className="st-page">
        <StatsCalendar data={data.calendar} />

        <div className="st-donuts">
          <DonutCard
            title="Rarity"
            segments={RARITY_LABELS.map((label, i) => ({ label, value: data.rarity.tiers[label], color: RARITY_COLORS[i] }))}
            center={`${data.rarity.average.toFixed(2)}%`}
            caption="Average"
            unit={["trophy", "trophies"]}
          />
          <DonutCard
            title="Completion"
            segments={COMPLETION_LABELS.map((label, i) => ({ label, value: data.completion.buckets[i], color: COMPLETION_COLORS[i] }))}
            center={`${data.completion.average.toFixed(2)}%`}
            caption="Average"
            unit={["game", "games"]}
          />
          <DonutCard
            title="PSN points"
            segments={[
              { label: "Platinum", value: data.points.platinum, color: TYPE_COLORS.platinum },
              { label: "Gold", value: data.points.gold, color: TYPE_COLORS.gold },
              { label: "Silver", value: data.points.silver, color: TYPE_COLORS.silver },
              { label: "Bronze", value: data.points.bronze, color: TYPE_COLORS.bronze },
            ]}
            center={formatInt(data.totalPoints)}
            caption="Points"
            unit={["point", "points"]}
          />
          <DonutCard
            title="Platforms"
            segments={[
              { label: "PS5", value: data.platforms.PS5, color: PLATFORM_COLORS.PS5 },
              { label: "PS4", value: data.platforms.PS4, color: PLATFORM_COLORS.PS4 },
            ]}
            center={formatInt(data.games)}
            caption="Games"
            unit={["game", "games"]}
          />
        </div>

        <MonthlyActivity months={data.months} />
        <TrophyProgression months={data.months} counts={data.counts} />

        <div className="st-row-2">
          <Panel title="Trophies by time" aside="Paris time">
            <ColumnChart
              labels={HOURS}
              values={data.hours}
              height={240}
              ariaLabel="Trophies by hour of the day"
              unit={["trophy", "trophies"]}
              titleOf={(i) => `${HOURS[i]}:00 – ${HOURS[i]}:59`}
              labelEvery={{ every: 2, belowWidth: 620 }}
            />
          </Panel>
          <Panel title="Trophies by day">
            <ColumnChart
              labels={WEEKDAYS}
              values={data.weekdays}
              height={240}
              ariaLabel="Trophies by day of the week"
              unit={["trophy", "trophies"]}
              titleOf={(i) => WEEKDAYS[i]}
            />
          </Panel>
        </div>

        <div className="st-row-3">
          <Panel title="Games by release year">
            {data.years.length > 0 && (
              <ColumnChart
                labels={data.years.map((y) => `'${String(y.year).slice(2)}`)}
                values={data.years.map((y) => y.games)}
                height={406}
                ariaLabel="Games by release year"
                unit={["game", "games"]}
                titleOf={(i) => String(data.years[i].year)}
                minSlot={24}
              />
            )}
            {noYear && <div className="st-note">{noYear}</div>}
          </Panel>
          <Panel title="Games by publisher">
            {publishers.length > 0 && <BarList items={publishers} />}
            {noPublisher && <div className="st-note">{noPublisher}</div>}
          </Panel>
          <Panel title="Games by genre">
            {data.genres.length > 0 && <BarList items={data.genres.map((g) => ({ name: g.name, value: g.games }))} />}
            <div className="st-note">
              A game can have several genres.{data.noGenre > 0 ? ` ${data.noGenre} ${data.noGenre === 1 ? "has" : "have"} none on PSN.` : ""}
            </div>
          </Panel>
        </div>

        <LevelHistory levels={data.levels} />
      </div>
    </ChartTipProvider>
  );
}
