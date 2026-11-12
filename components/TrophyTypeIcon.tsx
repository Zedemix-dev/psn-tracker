import type { TrophyType } from "@/src/db/schema";

const LABEL: Record<TrophyType, string> = {
  platinum: "Platinum",
  gold: "Gold",
  silver: "Silver",
  bronze: "Bronze",
};

export function TrophyTypeIcon({
  type,
  size = 20,
  className,
}: {
  type: TrophyType;
  size?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- images are already cached and sized by the app, no next/image optimizer wanted
    <img
      src={`/icons/40-${type}.png`}
      alt={LABEL[type]}
      title={LABEL[type]}
      width={size}
      height={size}
      className={className}
    />
  );
}
