const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const parisParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function parts(d: Date) {
  const get = (type: string) => parisParts.formatToParts(d).find((p) => p.type === type)!.value;
  return {
    day: Number(get("day")),
    month: MONTHS[Number(get("month")) - 1],
    year: get("year"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

export function formatDate(d: Date): string {
  const p = parts(d);
  return `${p.day} ${p.month} ${p.year}`;
}

export function formatDateTime(d: Date): string {
  const p = parts(d);
  return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute}`;
}

export function formatInt(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

export function formatPercent(n: number): string {
  return `${n.toFixed(2)}%`;
}

export function formatPlayTime(seconds: number): string {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${formatInt(h)}h ${String(m).padStart(2, "0")}m`;
}

export function formatHoursTotal(seconds: number): string {
  return `${formatInt(Math.floor(seconds / 3600))} h`;
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
}

export function formatRelative(d: Date, now: Date): string {
  const seconds = Math.max(0, (now.getTime() - d.getTime()) / 1000);
  const minutes = seconds / 60;
  const hours = minutes / 60;
  const days = hours / 24;
  if (minutes < 1) return "just now";
  if (hours < 1) return plural(Math.round(minutes), "minute");
  if (days < 1) return plural(Math.round(hours), "hour");
  if (days < 7) return plural(Math.round(days), "day");
  if (days < 30) return plural(Math.round(days / 7), "week");
  if (days < 365) return plural(Math.round(days / 30.44), "month");
  return plural(Math.round(days / 365.25), "year");
}

export function formatLastPlayedLine(lastPlayedAt: Date | null, playSeconds: number | null): string {
  if (!lastPlayedAt) return "";
  const base = `Last played ${formatDate(lastPlayedAt)}`;
  return playSeconds == null ? base : `${base} | ${formatPlayTime(playSeconds)} played`;
}
