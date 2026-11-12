import { TrophyTypeIcon } from "@/components/TrophyTypeIcon";
import type { TrophyItem } from "@/src/cabinet/item";

/** Typed trophy list shared by the cabinet and the rarest panel. */
export function TrophyRows({ items }: { items: TrophyItem[] }) {
  return (
    <ul className="tlist typed">
      {items.map((t) => (
        <li key={t.key} title={t.name}>
          {/* eslint-disable-next-line @next/next/no-img-element -- images are already cached and sized by the app, no next/image optimizer wanted */}
          <img src={t.iconSrc} alt="" loading="lazy" />
          <div>
            <div className="n">{t.name}</div>
            <div className="g">{t.game}</div>
          </div>
          <div className="r">
            {t.ratePct !== null && (
              <>
                <b>{t.ratePct}</b>
                {t.tier}
              </>
            )}
          </div>
          <TrophyTypeIcon type={t.type} size={30} className="ti" />
        </li>
      ))}
    </ul>
  );
}
