"use client";

import { tierOf, type LogPlatform, type LogRarity, type LogType } from "@/src/trophy-log/query";

const PLATFORMS: [LogPlatform, string][] = [
  ["all", "All platforms"],
  ["PS4", "PS4"],
  ["PS5", "PS5"],
];
const RARITIES: [LogRarity, string][] = [
  ["all", "All rarities"],
  ...(["ultra-rare", "very-rare", "rare", "uncommon", "common"] as const).map((r): [LogRarity, string] => [
    r,
    tierOf(r),
  ]),
];
const TYPES: [LogType, string][] = [
  ["all", "All types"],
  ["platinum", "Platinum"],
  ["gold", "Gold"],
  ["silver", "Silver"],
  ["bronze", "Bronze"],
];

export const selectClass = (active: boolean) => `select${active ? " on" : ""}`;

export function TrophyFilterSelects({
  value,
  onChange,
}: {
  value: { platform: LogPlatform; rarity: LogRarity; type: LogType };
  onChange: (next: { platform: LogPlatform; rarity: LogRarity; type: LogType }) => void;
}) {
  return (
    <>
      <select
        className={selectClass(value.platform !== "all")}
        aria-label="Filter by platform"
        value={value.platform}
        onChange={(e) => onChange({ ...value, platform: e.target.value as LogPlatform })}
      >
        {PLATFORMS.map(([option, label]) => (
          <option key={option} value={option}>
            {label}
          </option>
        ))}
      </select>
      <select
        className={selectClass(value.rarity !== "all")}
        aria-label="Filter by rarity"
        value={value.rarity}
        onChange={(e) => onChange({ ...value, rarity: e.target.value as LogRarity })}
      >
        {RARITIES.map(([option, label]) => (
          <option key={option} value={option}>
            {label}
          </option>
        ))}
      </select>
      <select
        className={selectClass(value.type !== "all")}
        aria-label="Filter by type"
        value={value.type}
        onChange={(e) => onChange({ ...value, type: e.target.value as LogType })}
      >
        {TYPES.map(([option, label]) => (
          <option key={option} value={option}>
            {label}
          </option>
        ))}
      </select>
    </>
  );
}

export function DirectionButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`${selectClass(active)} log-dir`} title="Reverse the order" onClick={onClick}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 4v16M4.5 16.5 8 20l3.5-3.5" />
          <path d="M16 20V4M12.5 7.5 16 4l3.5 3.5" />
        </g>
      </svg>
      {label}
    </button>
  );
}

export function ResetButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button type="button" className="log-reset" onClick={onClick}>
      <svg viewBox="0 0 12 12" aria-hidden="true">
        <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      Reset ({count})
    </button>
  );
}
