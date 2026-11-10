import type { TrophyType } from "@/src/db/schema";

export type EarnedOrderKey = { earnedAtMs: number; type: TrophyType; trophyId: number; titleId?: string };

const second = (ms: number) => Math.floor(ms / 1000);

/** Spec 16.4: second earned, then the platinum last, then trophyId, then titleId (code-unit order, "" when absent). */
export function compareEarnedOrder(a: EarnedOrderKey, b: EarnedOrderKey): number {
  const titleA = a.titleId ?? "";
  const titleB = b.titleId ?? "";
  return (
    second(a.earnedAtMs) - second(b.earnedAtMs) ||
    Number(a.type === "platinum") - Number(b.type === "platinum") ||
    a.trophyId - b.trophyId ||
    (titleA < titleB ? -1 : titleA > titleB ? 1 : 0)
  );
}
