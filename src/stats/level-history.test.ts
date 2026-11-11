import { describe, expect, it } from "vitest";
import type { TrophyType } from "@/src/db/schema";
import type { EarnedTrophy } from "./trophies";
import { levelCrossings, pointsForLevel } from "./level-history";

let seq = 0;
function trophy(type: TrophyType, earnedAt: Date, over: Partial<EarnedTrophy> = {}): EarnedTrophy {
  seq += 1;
  return { titleId: "T", trophyId: seq, name: `t${seq}`, detail: "", iconUrl: null, type, earnedAt, earnedRate: null, gameName: "G", ...over };
}
const day = (n: number) => new Date(Date.UTC(2024, 0, 1) + n * 86_400_000);

describe("pointsForLevel", () => {
  it.each([[1, 0], [2, 60], [100, 5940], [200, 14940], [300, 59940], [400, 149940], [500, 284940], [530, 338940], [536, 349740], [537, 351540], [600, 464940], [900, 1274940], [999, 1631340]])(
    "level %i needs %i points",
    (level, points) => expect(pointsForLevel(level)).toBe(points),
  );
});

describe("levelCrossings", () => {
  it("credits the trophy that reaches the threshold exactly", () => {
    const list = Array.from({ length: 36 }, (_, i) => trophy("bronze", day(i)));
    const out = levelCrossings(list);
    expect(out).toHaveLength(1);
    expect(out[0].level).toBe(10);
    expect(out[0].trophy).toBe(list[35]);
  });

  it("credits the trophy that passes the threshold", () => {
    const list = [trophy("platinum", day(0)), trophy("platinum", day(1))];
    const out = levelCrossings(list);
    expect(out.map((c) => c.level)).toEqual([10]);
    expect(out[0].trophy).toBe(list[1]);
  });

  it("uses the earned order: within a second the platinum comes last", () => {
    const at = new Date("2024-03-01T10:00:00.000Z");
    const filler = Array.from({ length: 34 }, (_, i) => trophy("bronze", day(-100 + i))); // 510 points
    const bronze = trophy("bronze", at); // 525
    const plat = trophy("platinum", new Date(at.getTime() + 500)); // 825, crosses 540
    const a = levelCrossings([plat, bronze, ...filler]);
    const b = levelCrossings([...filler, bronze, plat]);
    expect(a[0].trophy).toBe(plat);
    expect(b[0].trophy).toBe(plat);
  });

  it("returns levels 10, 20, 30 in order, oldest first", () => {
    const list = Array.from({ length: 4 }, (_, i) => trophy("platinum", day(i))); // 1200 points = level 21
    const out = levelCrossings(list);
    expect(out.map((c) => c.level)).toEqual([10, 20]);
    const big = [trophy("platinum", day(0))];
    for (let i = 1; i < 7; i++) big.push(trophy("platinum", day(i))); // 2100 points = level 36
    expect(levelCrossings(big).map((c) => c.level)).toEqual([10, 20, 30]);
  });

  it("returns nothing under level 10", () => {
    expect(levelCrossings([trophy("bronze", day(0))])).toEqual([]);
  });

  it("stops at level 999", () => {
    const many = Array.from({ length: 6000 }, (_, i) => trophy("platinum", day(i))); // 1 800 000 points
    const out = levelCrossings(many);
    expect(out.at(-1)!.level).toBe(990);
    expect(out).toHaveLength(99);
  });

  it("does not change the array it receives", () => {
    const list = [trophy("bronze", day(5)), trophy("bronze", day(1)), trophy("bronze", day(3))];
    const copy = [...list];
    levelCrossings(list);
    expect(list).toEqual(copy);
  });
});
