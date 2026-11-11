// Same history-entry rule as components/list-snapshot.ts, but no rows are stored: "Show all" can
// hold 11,636 of them, far past what sessionStorage keeps. Only how many were loaded and where the
// page was scrolled; the rows are fetched again on the way back.
// The place is the row at the top of the viewport (anchorKey) and how far it sits from the viewport
// top (anchorOffset, may be negative): a pixel y does not survive the rows being re-rendered with
// their real heights. scrollY is the fallback.
export type PlaceSnapshot = {
  key: string;
  loaded: number;
  scrollY: number;
  anchorKey?: string;
  anchorOffset?: number;
};

export type PlaceStore = {
  save(s: PlaceSnapshot): void;
  /** The saved place, only when the current history entry is the one it was taken on. */
  take(key: string): PlaceSnapshot | null;
};

export function createPlaceStore(storageKey: string, stateTag: string): PlaceStore {
  return {
    save(s) {
      try {
        const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
        sessionStorage.setItem(storageKey, JSON.stringify({ ...s, id }));
        history.replaceState({ ...history.state, [stateTag]: id }, "");
      } catch {
        // Private mode or quota: the list simply starts from the top next time.
      }
    },
    take(key) {
      try {
        const raw = sessionStorage.getItem(storageKey);
        if (!raw) return null;
        const s = JSON.parse(raw) as PlaceSnapshot & { id?: string };
        if (!s.id || history.state?.[stateTag] !== s.id) return null;
        if (s.key !== key || !Number.isInteger(s.loaded) || s.loaded < 1 || typeof s.scrollY !== "number") return null;
        const snap: PlaceSnapshot = { key: s.key, loaded: s.loaded, scrollY: s.scrollY };
        if (typeof s.anchorKey === "string" && typeof s.anchorOffset === "number" && Number.isFinite(s.anchorOffset)) {
          snap.anchorKey = s.anchorKey;
          snap.anchorOffset = s.anchorOffset;
        }
        return snap;
      } catch {
        return null;
      }
    },
  };
}
