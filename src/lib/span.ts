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

  let second = t.second - f.second;
  let minute = t.minute - f.minute;
  let hour = t.hour - f.hour;
  let day = t.day - f.day;
  let month = t.month - f.month;
  let year = t.year - f.year;

  if (second < 0) minute -= 1;
  if (minute < 0) {
    minute += 60;
    hour -= 1;
  }
  if (hour < 0) {
    hour += 24;
    day -= 1;
  }
  if (day < 0) {
    const prevMonth = t.month === 1 ? 12 : t.month - 1;
    const prevYear = t.month === 1 ? t.year - 1 : t.year;
    day += daysInMonth(prevYear, prevMonth);
    month -= 1;
  }
  if (month < 0) {
    month += 12;
    year -= 1;
  }

  const values = [year, month, Math.floor(day / 7), day % 7, hour, minute];
  const first = values.findIndex((v) => v > 0);
  if (first === -1) return "less than a minute";

  return values
    .map((v, i) => ({ v, unit: UNITS[i], i }))
    .filter(({ v, i }) => i >= first && i < first + maxUnits && v > 0)
    .map(({ v, unit }) => `${v} ${unit}${v === 1 ? "" : "s"}`)
    .join(", ");
}
