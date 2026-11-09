import type { UnobtainableEntry } from "@/src/db/schema";

export const LIST_UNREACHABLE = "Couldn't reach this address";
export const LIST_INVALID = "This address didn't return a valid list";

export type ParsedList = { ok: true; entries: UnobtainableEntry[] } | { ok: false; error: string };

const invalid: ParsedList = { ok: false, error: LIST_INVALID };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseEntry(id: string, raw: unknown): UnobtainableEntry | null {
  if (!isRecord(raw)) return null;
  const { title, platforms, trophies, note, timestamp } = raw;
  if (typeof title !== "string" || title === "") return null;
  if (!Array.isArray(trophies) || trophies.length === 0) return null;
  if (!trophies.every((t) => Number.isInteger(t) && (t as number) >= 0)) return null;
  const platformList = Array.isArray(platforms) ? platforms.filter((p): p is string => typeof p === "string") : [];
  const strings = [id, title, ...platformList, ...(typeof note === "string" ? [note] : [])];
  // Postgres refuses NUL characters in jsonb.
  if (strings.some((s) => s.includes("\u0000"))) return null;
  return {
    id,
    title,
    platforms: platformList,
    trophies: trophies as number[],
    note: typeof note === "string" && note !== "" ? note : null,
    timestamp: typeof timestamp === "number" && Number.isFinite(timestamp) ? timestamp : null,
  };
}

export function parseList(raw: unknown): ParsedList {
  if (!isRecord(raw) || raw.version !== 2 || !isRecord(raw.list)) return invalid;
  const entries: UnobtainableEntry[] = [];
  for (const [id, value] of Object.entries(raw.list)) {
    const entry = parseEntry(id, value);
    if (entry) entries.push(entry);
  }
  return entries.length > 0 ? { ok: true, entries } : invalid;
}

export function isListUrl(input: string): boolean {
  try {
    const { protocol } = new URL(input);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}
