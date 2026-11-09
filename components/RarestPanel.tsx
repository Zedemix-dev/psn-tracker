import { RarityBreakdown } from "@/components/RarityBreakdown";
import { TrophyRows } from "@/components/TrophyRows";
import type { TrophyItem } from "@/src/cabinet/item";
import type { RarityTier } from "@/src/lib/rarity";

export function RarestPanel({
  items,
  breakdown,
}: {
  items: TrophyItem[];
  breakdown: Record<RarityTier, number>;
}) {
  return (
    <section className="panel glass" aria-label="Rarest trophies">
      <div className="panel-head">
        <h2>Rarest trophies</h2>
        <span className="aside">global PSN rarity</span>
      </div>
      <TrophyRows items={items} />
      <RarityBreakdown breakdown={breakdown} />
    </section>
  );
}
