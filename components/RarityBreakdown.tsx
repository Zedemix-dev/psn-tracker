import { formatInt } from "@/src/lib/format";
import { RARITY_TIERS, type RarityTier } from "@/src/lib/rarity";

const CLASS: Record<RarityTier, string> = {
  "Ultra rare": "t1",
  "Very rare": "t2",
  Rare: "t3",
  Uncommon: "t4",
  Common: "t5",
};

export function RarityBreakdown({ breakdown }: { breakdown: Record<RarityTier, number> }) {
  const sum = RARITY_TIERS.reduce((s, t) => s + breakdown[t], 0) || 1;
  return (
    <div className="rarity">
      <div className="rbar" aria-hidden="true">
        {RARITY_TIERS.map((t) => (
          <i key={t} className={CLASS[t]} style={{ flex: breakdown[t] / sum }} />
        ))}
      </div>
      <div className="rgrid">
        {RARITY_TIERS.map((t) => (
          <div key={t}>
            <b>
              <i className={CLASS[t]} aria-hidden="true" />
              {formatInt(breakdown[t])}
            </b>
            <span>{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
