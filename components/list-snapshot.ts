import type { GameRowData } from "@/src/games/row";

export type ListSnapshot = { key: string; items: GameRowData[]; total: number; scrollY: number };

const STORAGE_KEY = "games-list";
const STATE_TAG = "gamesSnapshot";

// The snapshot is tied to the history entry it was taken on: saving tags that entry (merged into
// Next's own history.state), and restoring requires the tag on the entry being shown. Browser
// back/forward to that entry restores; a fresh visit pushes a new, untagged entry and starts at
// the top.
export function saveListSnapshot(s: ListSnapshot): void {
  try {
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...s, id }));
    history.replaceState({ ...history.state, [STATE_TAG]: id }, "");
  } catch {
    // Private mode or quota: the list simply starts from the top next time.
  }
}

/** The saved snapshot, only when the current history entry is the one it was taken on. */
export function takeListSnapshot(key: string): ListSnapshot | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as ListSnapshot & { id?: string };
    if (!s.id || history.state?.[STATE_TAG] !== s.id) return null;
    if (s.key !== key || !Array.isArray(s.items) || typeof s.total !== "number") return null;
    return s;
  } catch {
    return null;
  }
}
