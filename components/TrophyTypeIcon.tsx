import type { TrophyType } from "@/src/db/schema";

const LABEL: Record<TrophyType, string> = {
  platinum: "Platinum",
  gold: "Gold",
  silver: "Silver",
  bronze: "Bronze",
};

export function TrophyTypeIcon({ type, size = 20 }: { type: TrophyType; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/icons/40-${type}.png`} alt={LABEL[type]} title={LABEL[type]} width={size} height={size} />
  );
}
