const parisFull = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function wall(d: Date) {
  const m = new Map(parisFull.formatToParts(d).map((p) => [p.type, Number(p.value)]));
  return {
    year: m.get("year")!,
    month: m.get("month")!,
    day: m.get("day")!,
    hour: m.get("hour")!,
    minute: m.get("minute")!,
    second: m.get("second")!,
  };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const UNITS = ["year", "month", "week", "day", "hour", "minute"] as const;

/** Calendar duration between two instants, counted on Paris wall-clock time. */
export function formatSpan(from: Date, to: Date, maxUnits = 6): string {
  const [a, b] = from <= to ? [from, to] : [to, from];
  const f = wall(a);
  const t = wall(b);

  // Whole months first, stepping from `from` with the day clamped to the target month length.
  const anchor = (months: number) => {
    const idx = f.year * 12 + (f.month - 1) + months;
    const year = Math.floor(idx / 12);
    const month = (idx % 12) + 1;
    const day = Math.min(f.day, daysInMonth(year, month));
    return Date.UTC(year, month - 1, day, f.hour, f.minute, f.second);
  };
  const end = Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second);
  let totalMonths = (t.year - f.year) * 12 + (t.month - f.month);
  if (anchor(totalMonths) > end) totalMonths -= 1;

  // Then the remaining time, which is always non-negative and shorter than a month.
  let rest = Math.floor((end - anchor(totalMonths)) / 1000);
  const day = Math.floor(rest / 86400);
  rest -= day * 86400;
  const hour = Math.floor(rest / 3600);
  rest -= hour * 3600;
  const minute = Math.floor(rest / 60);
  const year = Math.floor(totalMonths / 12);
  const month = totalMonths % 12;

  const values = [year, month, Math.floor(day / 7), day % 7, hour, minute];
  const first = values.findIndex((v) => v > 0);
  if (first === -1) return "less than a minute";

  return values
    .map((v, i) => ({ v, unit: UNITS[i], i }))
    .filter(({ v, i }) => i >= first && i < first + maxUnits && v > 0)
    .map(({ v, unit }) => `${v} ${unit}${v === 1 ? "" : "s"}`)
    .join(", ");
}
