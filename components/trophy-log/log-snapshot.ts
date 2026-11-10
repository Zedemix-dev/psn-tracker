// Same history-entry rule as components/list-snapshot.ts, but no rows are stored: "Show all" can
// hold 11,636 of them, far past what sessionStorage keeps. Only how many were loaded and where the
// page was scrolled; the rows are fetched again on the way back.
export type LogSnapshot = { key: string; loaded: number; scrollY: number };

const STORAGE_KEY = "trophy-log-list";
const STATE_TAG = "trophyLogSnapshot";

export function saveLogSnapshot(s: LogSnapshot): void {
  try {
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...s, id }));
    history.replaceState({ ...history.state, [STATE_TAG]: id }, "");
  } catch {
    // Private mode or quota: the list simply starts from the top next time.
  }
}

/** The saved place, only when the current history entry is the one it was taken on. */
export function takeLogSnapshot(key: string): LogSnapshot | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as LogSnapshot & { id?: string };
    if (!s.id || history.state?.[STATE_TAG] !== s.id) return null;
    if (s.key !== key || !Number.isInteger(s.loaded) || s.loaded < 1 || typeof s.scrollY !== "number") return null;
    return { key: s.key, loaded: s.loaded, scrollY: s.scrollY };
  } catch {
    return null;
  }
}
