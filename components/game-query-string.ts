import type { GameQuery } from "@/src/games/query";

/** Where the Games list puts its "Show all" button: a slot in the server-rendered panel header. */
export const SHOW_ALL_SLOT_ID = "games-show-all";

/** URL parameters for a games query; default values and the offset are left out. */
export function gameQueryParams(query: Omit<GameQuery, "offset">): URLSearchParams {
  const params = new URLSearchParams();
  if (query.state !== "all") params.set("state", query.state);
  if (query.platform !== "all") params.set("platform", query.platform);
  if (query.sort !== "lastTrophy") params.set("sort", query.sort);
  if (query.q) params.set("q", query.q);
  if (query.unobtainable !== "off") params.set("unobtainable", query.unobtainable);
  return params;
}
