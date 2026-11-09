import { describe, expect, it } from "vitest";
import type { UnobtainableEntry } from "@/src/db/schema";
import { buildIndex, matchTitle, nameKey, toTrophyIds } from "./match";

describe("nameKey", () => {
  it.each([
    ["Need for Speed™ Heat", "need for speed heat"],
    ["Foo™Bar", "foobar"],
    ["Rayman® Legends", "rayman legends"],
    ["Ghost of Yōtei", "ghost of yotei"],
    ["FINAL FANTASY Ⅻ THE ZODIAC AGE", "final fantasy xii the zodiac age"],
    ["A KING'S TALE: FF XV", "a king s tale ff xv"],
    ["™", ""],
  ])("nameKey(%s)", (a, b) => expect(nameKey(a)).toBe(b));
  it("keeps non-Latin names", () => expect(nameKey("まいにちいっしょ")).not.toBe(""));
});

const e = (
  id: string,
  title: string,
  platforms: string[],
  trophies: number[],
  note: string | null = null,
  timestamp: number | null = null,
): UnobtainableEntry => ({ id, title, platforms, trophies, note, timestamp });
const m = (entries: UnobtainableEntry[], name: string, platforms: string[]) =>
  matchTitle(buildIndex(entries), { name, platforms });

describe("matchTitle", () => {
  it("matches a PSN name with ™ to a plain list title", () =>
    expect(m([e("1", "Need for Speed Heat", ["PS4"], [3])], "Need for Speed™ Heat", ["PS4"])).toEqual({
      all: false,
      numbers: [3],
      note: null,
    }));
  it("needs a shared platform", () =>
    expect(m([e("1", "The First Descendant", ["PS4"], [0])], "The First Descendant", ["PS5"])).toBeNull());
  it("maps PSVITA and PSPC", () => {
    expect(m([e("1", "G", ["Vita"], [1])], "G", ["PSVITA", "PS4"])).not.toBeNull();
    expect(m([e("1", "G", ["PC"], [1])], "G", ["PS5", "PSPC"])).not.toBeNull();
  });
  it("never matches on VR alone", () => {
    expect(m([e("1", "G", ["VR"], [1])], "G", ["PS4"])).toBeNull();
    expect(m([e("1", "G", ["PS4"], [1])], "G", ["VR"])).toBeNull();
    expect(m([e("1", "G", ["VR"], [1])], "G", ["VR"])).toBeNull();
    expect(m([e("1", "G", ["PS4", "VR"], [1])], "G", ["PS4"])).not.toBeNull();
    expect(m([e("1", "G", ["VR"], [1])], "G", ["PS4", "VR"])).toBeNull();
    expect(m([e("1", "G", ["PS4"], [1])], "G", ["PS4", "VR"])).not.toBeNull();
  });
  it("never matches an empty key", () => expect(m([e("1", "®", ["PS4"], [1])], "™", ["PS4"])).toBeNull());
  it("merges several entries", () =>
    expect(m([e("1", "G", ["PS4"], [1, 5]), e("2", "G", ["PS4"], [5, 9])], "G", ["PS4"])).toEqual({
      all: false,
      numbers: [1, 5, 9],
      note: null,
    }));
  it("ignores entries of another platform when merging", () =>
    expect(m([e("1", "G", ["PS4"], [1]), e("2", "G", ["PS5"], [2])], "G", ["PS4"])?.numbers).toEqual([1]));
  it("treats any 0 as the whole game", () => {
    const r = m([e("1", "G", ["PS4"], [7]), e("2", "G", ["PS4"], [0])], "G", ["PS4"]);
    expect(r?.all).toBe(true);
    expect(r?.numbers).toEqual([]);
  });
  it("takes the note of the newest entry that has one", () => {
    const r = m(
      [e("1", "G", ["PS4"], [1], "old", 5), e("2", "G", ["PS4"], [1], null, 9), e("3", "G", ["PS4"], [1], "new", 7)],
      "G",
      ["PS4"],
    );
    expect(r?.note).toBe("new");
  });
  it("puts entries without a timestamp after the others", () =>
    expect(
      m([e("1", "G", ["PS4"], [1], "none", null), e("2", "G", ["PS4"], [1], "dated", 1)], "G", ["PS4"])?.note,
    ).toBe("dated"));
  it("breaks note ties on the smallest numeric id", () => {
    expect(
      m([e("10", "G", ["PS4"], [1], "ten", 5), e("9", "G", ["PS4"], [1], "nine", 5)], "G", ["PS4"])?.note,
    ).toBe("nine");
    expect(
      m([e("10", "G", ["PS4"], [1], "ten"), e("9", "G", ["PS4"], [1], "nine")], "G", ["PS4"])?.note,
    ).toBe("nine");
  });
});

describe("toTrophyIds", () => {
  it("converts numbers to trophy ids and drops unknown ones", () =>
    expect(toTrophyIds({ all: false, numbers: [1, 2, 99], note: null }, [0, 1, 5])).toEqual([0, 1]));
  it("returns every id for the whole game", () =>
    expect(toTrophyIds({ all: true, numbers: [], note: null }, [0, 1, 5])).toEqual([0, 1, 5]));
});
