import { CabinetEditor } from "@/components/CabinetEditor";
import { TrophyRows } from "@/components/TrophyRows";
import type { TrophyItem } from "@/src/cabinet/item";

export function CabinetPanel({ items }: { items: TrophyItem[] }) {
  return (
    <section className="panel glass" aria-label="Trophy cabinet">
      <div className="panel-head">
        <h2>Trophy cabinet</h2>
        <CabinetEditor initial={items} />
      </div>
      {items.length === 0 ? (
        <p className="empty">Pick up to 10 trophies to show here.</p>
      ) : (
        <TrophyRows items={items} />
      )}
    </section>
  );
}
