import type { TrophyType } from "@/src/db/schema";
import { parisDateParts } from "@/src/lib/format";
import { RARITY_TIERS, rarityTier, type RarityTier } from "@/src/lib/rarity";
import { TROPHY_POINTS } from "@/src/games/detail-stats";
import type { EarnedTrophy } from "./trophies";

export type CalendarDay = { date: string; label: string; trophies: number; platinums: number };
export type CalendarSummary = {
  trophies: number;
  platinums: number;
  bestDay: { trophies: number; label: string } | null;
  streak: { days: number; trophies: number; from: string; to: string } | null;
};
export type CalendarData = {
  weeks: (CalendarDay | null)[][];
  months: { column: number; label: string }[];
  summary: CalendarSummary;
};
export type MonthPoint = { label: string; title: string; trophies: number; platinum: number; gold: number; silver: number; bronze: number };
export type TrophyCharts = {
  total: number;
  calendar: CalendarData;
  rarity: { tiers: Record<RarityTier, number>; average: number };
  points: Record<TrophyType, number>;
  totalPoints: number;
  counts: Record<TrophyType, number>;
  months: MonthPoint[];
  hours: number[];
  weekdays: number[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_MS = 86_400_000;
const WEEKS = 53;
const TYPES: TrophyType[] = ["platinum", "gold", "silver", "bronze"];

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const shortDate = (d: Date) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
const dayLabel = (d: Date) => `${WEEKDAYS[(d.getUTCDay() + 6) % 7]} ${shortDate(d)}`;
const keyOf = (d: Date) => dayKey(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());

type Run = { days: number; n: number; from: Date; to: Date };

function buildCalendar(perDay: Map<string, { n: number; p: number }>, now: Date): CalendarData {
  const t = parisDateParts(now);
  // The grid walks UTC noon dates, so a clock change never moves a day.
  const today = new Date(Date.UTC(t.year, t.month - 1, t.day, 12));
  const monday = new Date(today.getTime() - t.weekday * DAY_MS);
  const start = new Date(monday.getTime() - (WEEKS - 1) * 7 * DAY_MS);

  const weeks: (CalendarDay | null)[][] = [];
  const months: { column: number; label: string }[] = [];
  let trophies = 0;
  let platinums = 0;
  let best: { n: number; d: Date } | null = null;
  let run: Run | null = null;
  let streak: Run | null = null;

  for (let w = 0; w < WEEKS; w++) {
    const first = new Date(start.getTime() + w * 7 * DAY_MS);
    // A month is named above its first Monday, except in the last two columns where it would overflow.
    if (first.getUTCDate() <= 7 && w < WEEKS - 2) months.push({ column: w, label: MONTHS[first.getUTCMonth()] });
    weeks.push(Array.from({ length: 7 }, () => null));
  }
  for (let i = 0; i < WEEKS * 7; i++) {
    const d = new Date(start.getTime() + i * DAY_MS);
    if (d > today) continue;
    const key = keyOf(d);
    const v = perDay.get(key) ?? { n: 0, p: 0 };
    weeks[Math.floor(i / 7)][i % 7] = { date: key, label: dayLabel(d), trophies: v.n, platinums: v.p };
    trophies += v.n;
    platinums += v.p;
    if (v.n > 0) {
      if (!best || v.n >= best.n) best = { n: v.n, d };
      run = run ? { days: run.days + 1, n: run.n + v.n, from: run.from, to: d } : { days: 1, n: v.n, from: d, to: d };
      if (!streak || run.days >= streak.days) streak = run;
    } else {
      run = null;
    }
  }

  return {
    weeks,
    months,
    summary: {
      trophies,
      platinums,
      bestDay: best ? { trophies: best.n, label: dayLabel(best.d) } : null,
      streak: streak ? { days: streak.days, trophies: streak.n, from: shortDate(streak.from), to: shortDate(streak.to) } : null,
    },
  };
}

export function buildTrophyCharts(trophies: EarnedTrophy[], now: Date): TrophyCharts {
  const perDay = new Map<string, { n: number; p: number }>();
  const perMonth = new Map<number, Record<TrophyType, number>>(); // year * 12 + month index
  const tiers = Object.fromEntries(RARITY_TIERS.map((t) => [t, 0])) as Record<RarityTier, number>;
  const counts: Record<TrophyType, number> = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  const hours = new Array<number>(24).fill(0);
  const weekdays = new Array<number>(7).fill(0);
  let rateSum = 0;
  let rated = 0;
  let firstMonth = Infinity;

  for (const tr of trophies) {
    const p = parisDateParts(tr.earnedAt);
    const key = dayKey(p.year, p.month, p.day);
    const day = perDay.get(key) ?? { n: 0, p: 0 };
    day.n += 1;
    if (tr.type === "platinum") day.p += 1;
    perDay.set(key, day);

    const m = p.year * 12 + p.month - 1;
    firstMonth = Math.min(firstMonth, m);
    const bucket = perMonth.get(m) ?? { platinum: 0, gold: 0, silver: 0, bronze: 0 };
    bucket[tr.type] += 1;
    perMonth.set(m, bucket);

    counts[tr.type] += 1;
    hours[p.hour] += 1;
    weekdays[p.weekday] += 1;
    if (tr.earnedRate != null) {
      tiers[rarityTier(tr.earnedRate)] += 1;
      rateSum += tr.earnedRate;
      rated += 1;
    }
  }

  const points = Object.fromEntries(TYPES.map((t) => [t, counts[t] * TROPHY_POINTS[t]])) as Record<TrophyType, number>;
  const n = parisDateParts(now);
  const lastMonth = n.year * 12 + n.month - 1;
  const months: MonthPoint[] = [];
  const running: Record<TrophyType, number> = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
  for (let m = firstMonth; m <= lastMonth; m++) {
    const b = perMonth.get(m);
    for (const t of TYPES) running[t] += b?.[t] ?? 0;
    const year = Math.floor(m / 12);
    const name = MONTHS[m % 12];
    months.push({
      label: `${name} ${pad(year % 100)}`,
      title: `${name} ${year}`,
      trophies: b ? b.platinum + b.gold + b.silver + b.bronze : 0,
      ...running,
    });
  }

  return {
    total: trophies.length,
    calendar: buildCalendar(perDay, now),
    rarity: { tiers, average: rated ? Math.round((rateSum / rated) * 100) / 100 : 0 },
    points,
    totalPoints: TYPES.reduce((s, t) => s + points[t], 0),
    counts,
    months,
    hours,
    weekdays,
  };
}
