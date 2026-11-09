import type { UnobtainableEntry } from "@/src/db/schema";

export type MatchIndex = Map<string, UnobtainableEntry[]>;
export type TitleMatch = { all: boolean; numbers: number[]; note: string | null };

/** Order matters: NFKD turns ™ into "TM", so the marks go first. */
export function nameKey(name: string): string {
  return name
    .replace(/[™®©]/g, "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const PLATFORM_ALIASES: Record<string, string> = { PSVITA: "Vita", PSPC: "PC" };

/** VR is not a platform on its own: it never counts as shared. */
function platformSet(platforms: string[]): Set<string> {
  const set = new Set<string>();
  for (const p of platforms) {
    if (p === "VR") continue;
    set.add(PLATFORM_ALIASES[p] ?? p);
  }
  return set;
}

export function buildIndex(entries: UnobtainableEntry[]): MatchIndex {
  const index: MatchIndex = new Map();
  for (const entry of entries) {
    const key = nameKey(entry.title);
    if (key === "") continue;
    const bucket = index.get(key);
    if (bucket) bucket.push(entry);
    else index.set(key, [entry]);
  }
  return index;
}

/** Newest timestamp first, no timestamp last, then the smallest numeric id. */
function noteOrder(a: UnobtainableEntry, b: UnobtainableEntry): number {
  if (a.timestamp !== b.timestamp) {
    if (a.timestamp === null) return 1;
    if (b.timestamp === null) return -1;
    return b.timestamp - a.timestamp;
  }
  return Number(a.id) - Number(b.id);
}

export function matchTitle(
  index: MatchIndex,
  title: { name: string; platforms: string[] },
): TitleMatch | null {
  const key = nameKey(title.name);
  if (key === "") return null;
  const candidates = index.get(key);
  if (!candidates) return null;
  const mine = platformSet(title.platforms);
  const matched = candidates.filter((c) => [...platformSet(c.platforms)].some((p) => mine.has(p)));
  if (matched.length === 0) return null;

  const all = matched.some((c) => c.trophies.includes(0));
  const numbers = all ? [] : [...new Set(matched.flatMap((c) => c.trophies))].sort((a, b) => a - b);
  const note = matched.filter((c) => c.note !== null).sort(noteOrder)[0]?.note ?? null;
  return { all, numbers, note };
}

/** List numbers are 1-based; trophy ids are 0-based. Unknown numbers are dropped. */
export function toTrophyIds(match: TitleMatch, existingIds: number[]): number[] {
  if (match.all) return [...existingIds];
  const existing = new Set(existingIds);
  return match.numbers.map((n) => n - 1).filter((id) => existing.has(id));
}
