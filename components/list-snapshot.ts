import type { GameRowData } from "@/src/games/row";

export type ListSnapshot = { key: string; items: GameRowData[]; total: number; scrollY: number };

const STORAGE_KEY = "games-list";

// A history traversal (browser back, phone back gesture) fires popstate before the page renders;
// a fresh visit (menu link, new tab) does not. That tells a "come back" apart from a new visit.
let traversed = false;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    traversed = true;
  });
}

export function saveListSnapshot(s: ListSnapshot): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Private mode or quota: the list simply starts from the top next time.
  }
}

/** The saved snapshot, only after a history traversal and for the same key. Always consumed. */
export function takeListSnapshot(key: string): ListSnapshot | null {
  const wasTraversal = traversed;
  traversed = false;
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!wasTraversal || !raw) return null;
  try {
    const s = JSON.parse(raw) as ListSnapshot;
    if (s.key !== key || !Array.isArray(s.items) || typeof s.total !== "number") return null;
    return s;
  } catch {
    return null;
  }
}
