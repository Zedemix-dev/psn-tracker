// Where a list was left when a game was opened, for Back. The place is tied to the history entry it
// was taken on: saving tags that entry (merged into Next's own history.state), and restoring requires
// the tag on the entry being shown. Browser back/forward to that entry restores; a fresh visit pushes
// a new, untagged entry and starts at the top.
// The place itself holds no rows: "Show all" can hold 11,636 trophies, far past what sessionStorage
// keeps. Only how many were loaded and where the page was scrolled; those rows are fetched again on
// the way back. A list short enough to keep (Games) also saves its rows, in an entry of their own
// tied to the place, so Back puts them back with no request; if they do not fit, the place alone.
// The place is the row at the top of the viewport (anchorKey) and how far it sits from the viewport
// top (anchorOffset, may be negative): a pixel y does not survive the rows being re-rendered with
// their real heights. scrollY is the fallback.
export type PlaceSnapshot = {
  key: string;
  loaded: number;
  scrollY: number;
  anchorKey?: string;
  anchorOffset?: number;
  /** Only from a list that keeps its rows. */
  rows?: KeptRows;
};

/** What a list showed, to resume exactly where it was. */
export type KeptRows = {
  items: unknown[];
  total: number;
  /** Where the next page starts: past items.length when rows already shown were dropped. */
  offset: number;
  /** An empty page came back: nothing more to load. */
  exhausted: boolean;
};

export type PlaceStore = {
  save(s: PlaceSnapshot): void;
  /** The saved place, only when the current history entry is the one it was taken on; with
   *  `withRows`, also the rows saved with it, when they read back. */
  take(key: string, withRows?: boolean): PlaceSnapshot | null;
};

export function createPlaceStore(storageKey: string, stateTag: string): PlaceStore {
  const rowsKey = `${storageKey}:rows`;
  return {
    save({ rows, ...place }) {
      try {
        const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
        sessionStorage.setItem(storageKey, JSON.stringify({ ...place, id }));
        if (rows) {
          sessionStorage.removeItem(rowsKey); // room for the new rows
          try {
            sessionStorage.setItem(rowsKey, JSON.stringify({ ...rows, id }));
          } catch {
            // Quota: the place alone; Back fetches the rows again.
          }
        }
        history.replaceState({ ...history.state, [stateTag]: id }, "");
      } catch {
        // Private mode or quota: the list simply starts from the top next time.
      }
    },
    take(key, withRows = false) {
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
        if (withRows) {
          const rows = readRows(rowsKey, s.id);
          if (rows) snap.rows = rows;
        }
        return snap;
      } catch {
        return null;
      }
    },
  };
}

/** The rows saved with the place `id`, or null when missing, from another place or unreadable. */
function readRows(rowsKey: string, id: string): KeptRows | null {
  try {
    const raw = sessionStorage.getItem(rowsKey);
    if (!raw) return null;
    const r = JSON.parse(raw) as Partial<KeptRows> & { id?: string };
    if (r.id !== id || !Array.isArray(r.items) || typeof r.total !== "number") return null;
    if (typeof r.offset !== "number" || !Number.isInteger(r.offset) || r.offset < 0) return null;
    if (typeof r.exhausted !== "boolean") return null;
    return { items: r.items, total: r.total, offset: r.offset, exhausted: r.exhausted };
  } catch {
    return null;
  }
}
