import type { TrophyType } from "@/src/db/schema";
import { formatPercent } from "@/src/lib/format";
import { rarityTier, type RarityTier } from "@/src/lib/rarity";
import { type ImageMap, mediaSrc } from "@/src/sync/images";
import type { EarnedTrophy } from "@/src/stats/trophies";

/** JSON-safe trophy for the side panels, the editor and the search route (no Date, no raw url). */
export type TrophyItem = {
  key: string;
  titleId: string;
  trophyId: number;
  name: string;
  game: string;
  type: TrophyType;
  iconSrc: string;
  ratePct: string | null;
  tier: RarityTier | null;
};

export function toTrophyItem(t: EarnedTrophy, imageMap: ImageMap): TrophyItem {
  return {
    key: `${t.titleId}-${t.trophyId}`,
    titleId: t.titleId,
    trophyId: t.trophyId,
    name: t.name,
    game: t.gameName,
    type: t.type,
    iconSrc: mediaSrc(t.iconUrl, imageMap),
    ratePct: t.earnedRate === null ? null : formatPercent(t.earnedRate),
    tier: t.earnedRate === null ? null : rarityTier(t.earnedRate),
  };
}
