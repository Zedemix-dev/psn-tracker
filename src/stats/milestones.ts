import type { Db } from "@/src/db/client";
import { compareEarnedOrder } from "@/src/lib/earned-order";
import { formatInt } from "@/src/lib/format";
import { getAllEarned, type EarnedTrophy } from "@/src/stats/trophies";

export type Milestone = { label: string; trophy: EarnedTrophy };

export function ordinal(n: number): string {
  const mod100 = n % 100;
  let suffix = "th";
  if (mod100 < 11 || mod100 > 13) {
    suffix = ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  }
  return `${formatInt(n)}${suffix}`;
}

// Same steps as psnprofiles: 10…50 by 10, then by 25 up to the 250th, then every 50.
function isPlatinumMilestone(n: number): boolean {
  if (n <= 50) return n % 10 === 0;
  return n <= 250 ? n % 25 === 0 : n % 50 === 0;
}

// 500…5,000 by 500, then by 1,000 up to the 10,000th, then every 5,000; plus the 1,337th.
function isTrophyMilestone(n: number): boolean {
  if (n === 1337) return true;
  if (n < 500) return false;
  if (n <= 5000) return n % 500 === 0;
  return n <= 10_000 ? n % 1000 === 0 : n % 5000 === 0;
}

const byEarnedOrder = (a: EarnedTrophy, b: EarnedTrophy) =>
  compareEarnedOrder(
    { earnedAtMs: a.earnedAt.getTime(), type: a.type, trophyId: a.trophyId, titleId: a.titleId },
    { earnedAtMs: b.earnedAt.getTime(), type: b.type, trophyId: b.trophyId, titleId: b.titleId },
  );

/** `_now` is part of the interface but unused: relative times are rendered by the UI. */
export function computeMilestones(earned: EarnedTrophy[], _now: Date): Milestone[] {
  const ordered = [...earned].sort(byEarnedOrder);
  if (ordered.length === 0) return [];

  // pos = index in counting order; entries are pushed in label emission order.
  const found: { pos: number; label: string }[] = [];
  const add = (pos: number, label: string) => found.push({ pos, label });

  const platinumPositions: number[] = [];
  ordered.forEach((t, i) => {
    if (t.type === "platinum") platinumPositions.push(i);
  });

  add(0, "First trophy");
  if (platinumPositions.length > 0) {
    add(platinumPositions[0], "First platinum");
    add(platinumPositions[platinumPositions.length - 1], "Latest platinum");

    const firstOfTitle = new Map<string, number>();
    for (const t of ordered) {
      const ms = t.earnedAt.getTime();
      const cur = firstOfTitle.get(t.titleId);
      if (cur === undefined || ms < cur) firstOfTitle.set(t.titleId, ms);
    }
    let fastest = platinumPositions[0];
    let fastestGap = Infinity;
    for (const pos of platinumPositions) {
      const t = ordered[pos];
      const gap = t.earnedAt.getTime() - firstOfTitle.get(t.titleId)!;
      if (gap < fastestGap) {
        fastestGap = gap;
        fastest = pos;
      }
    }
    add(fastest, "Fastest platinum");

    platinumPositions.forEach((pos, i) => {
      if (isPlatinumMilestone(i + 1)) add(pos, `${ordinal(i + 1)} platinum`);
    });
  }
  ordered.forEach((_, i) => {
    if (isTrophyMilestone(i + 1)) add(i, `${ordinal(i + 1)} trophy`);
  });

  // Newest first; the sort is stable so one trophy keeps its labels in emission order.
  return found.sort((a, b) => b.pos - a.pos).map(({ pos, label }) => ({ label, trophy: ordered[pos] }));
}

export async function getMilestones(db: Db, now: Date): Promise<Milestone[]> {
  return computeMilestones(await getAllEarned(db), now);
}
