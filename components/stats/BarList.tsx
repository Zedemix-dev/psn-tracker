import { formatInt } from "@/src/stats/chart-geometry";

export function BarList({ items }: { items: { name: string; value: number; other?: boolean }[] }) {
  const max = Math.max(1, ...items.map((it) => it.value));
  return (
    <ul className="st-bars">
      {items.map((it) => (
        <li key={it.name} className={it.other ? "o" : undefined}>
          <div className="n" title={it.name}>
            {it.name}
          </div>
          <div className="t">
            <div className="b" style={{ width: `calc((100% - 34px) * ${it.value / max})` }} />
            <div className="v">{formatInt(it.value)}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
