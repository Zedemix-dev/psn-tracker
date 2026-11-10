import { compareEarnedOrder } from "@/src/lib/earned-order";
import type { TrophyRowData } from "@/src/games/detail";

export type TrophyShow = "all" | "earned" | "unearned";
export type TrophySort = "psn" | "date" | "rarity";

export function parseTrophyView(params: URLSearchParams): { show: TrophyShow; sort: TrophySort } {
  const show = params.get("show");
  const sort = params.get("sort");
  return {
    show: show === "earned" || show === "unearned" ? show : "all",
    sort: sort === "date" || sort === "rarity" ? sort : "psn",
  };
}

/** Default values are omitted. */
export function trophyViewParams(view: { show: TrophyShow; sort: TrophySort }): URLSearchParams {
  const params = new URLSearchParams();
  if (view.show !== "all") params.set("show", view.show);
  if (view.sort !== "psn") params.set("sort", view.sort);
  return params;
}

export function filterAndSort(rows: TrophyRowData[], show: TrophyShow, sort: TrophySort): TrophyRowData[] {
  const kept = rows.filter((t) => show === "all" || (show === "earned") === t.earned);
  const byId = (a: TrophyRowData, b: TrophyRowData) => a.id - b.id;
  if (sort === "date") {
    return kept.sort((a, b) => {
      if (a.earnedAtMs != null && b.earnedAtMs != null) {
        return (
          compareEarnedOrder(
            { earnedAtMs: a.earnedAtMs, type: a.type, trophyId: a.id },
            { earnedAtMs: b.earnedAtMs, type: b.type, trophyId: b.id },
          ) || byId(a, b)
        );
      }
      if (a.earnedAtMs != null) return -1;
      if (b.earnedAtMs != null) return 1;
      return byId(a, b);
    });
  }
  if (sort === "rarity") {
    return kept.sort((a, b) => {
      if (a.rate != null && b.rate != null) return a.rate - b.rate || byId(a, b);
      if (a.rate != null) return -1;
      if (b.rate != null) return 1;
      return byId(a, b);
    });
  }
  return kept.sort(byId);
}
