"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ExportPreview } from "@/components/plat-wall/ExportPreview";
import {
  PLAT_SHOW,
  platQueryParams,
  type PlatPlatform,
  type PlatQuery,
  type PlatShow,
  type PlatSort,
} from "@/src/plat-wall/query";

const SHOW_LABELS: Record<PlatShow, string> = { art: "Art", rarity: "Rarity", name: "Name" };
const PLATFORMS: [PlatPlatform, string][] = [
  ["all", "All platforms"],
  ["PS4", "PS4"],
  ["PS5", "PS5"],
];
const SORTS: [PlatSort, string][] = [
  ["newest", "Newest"],
  ["rarity", "Rarity"],
  ["alphabetical", "Alphabetical"],
];

export function PlatWallControls({
  query,
  years,
  canExport,
  fileName,
}: {
  query: PlatQuery;
  years: number[];
  canExport: boolean;
  fileName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const dd = useRef<HTMLDivElement>(null);
  const closePreview = useCallback(() => setPreviewing(false), []);

  function go(next: PlatQuery) {
    const qs = platQueryParams(next).toString();
    router.replace(qs ? `/plat-wall?${qs}` : "/plat-wall", { scroll: false });
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!dd.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle(item: PlatShow) {
    const on = query.show.includes(item);
    if (on && query.show.length === 1) return;
    const set = on ? query.show.filter((s) => s !== item) : [...query.show, item];
    go({ ...query, show: PLAT_SHOW.filter((s) => set.includes(s)) });
  }

  return (
    <div className="wall-tools">
      <div className="dd" ref={dd}>
        <button type="button" className="select" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          Display
        </button>
        {open && (
          <div className="dd-menu">
            {PLAT_SHOW.map((item) => (
              <label key={item}>
                <input
                  type="checkbox"
                  checked={query.show.includes(item)}
                  disabled={query.show.length === 1 && query.show[0] === item}
                  onChange={() => toggle(item)}
                />{" "}
                {SHOW_LABELS[item]}
              </label>
            ))}
          </div>
        )}
      </div>
      <select
        className={`select${query.year !== null ? " on" : ""}`}
        aria-label="Filter by year"
        value={query.year === null ? "all" : String(query.year)}
        onChange={(e) => go({ ...query, year: e.target.value === "all" ? null : Number(e.target.value) })}
      >
        <option value="all">All years</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <select
        className={`select${query.platform !== "all" ? " on" : ""}`}
        aria-label="Filter by platform"
        value={query.platform}
        onChange={(e) => go({ ...query, platform: e.target.value as PlatPlatform })}
      >
        {PLATFORMS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <select
        className="select"
        aria-label="Sort by"
        value={query.sort}
        onChange={(e) => go({ ...query, sort: e.target.value as PlatSort })}
      >
        {SORTS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <button type="button" className="btn-export" disabled={!canExport} onClick={() => setPreviewing(true)}>
        <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
          <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14" />
          </g>
        </svg>
        Export PNG
      </button>
      {previewing && <ExportPreview query={query} fileName={fileName} onClose={closePreview} />}
    </div>
  );
}
