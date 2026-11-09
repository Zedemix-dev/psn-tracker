import { describe, expect, it } from "vitest";
import { notePlainText, parseNote } from "@/src/unobtainable/note";

const closed =
  "The servers closed on January 31st, 2024: [more info.](https://forum.psnprofiles.com/topic/1)";

describe("parseNote", () => {
  it("splits a link", () =>
    expect(parseNote(closed)).toEqual([
      { text: "The servers closed on January 31st, 2024: " },
      { text: "more info.", href: "https://forum.psnprofiles.com/topic/1" },
    ]));
  it("keeps text after a link", () =>
    expect(parseNote("A [b](https://x.dev) C")).toEqual([
      { text: "A " },
      { text: "b", href: "https://x.dev" },
      { text: " C" },
    ]));
  it("never links a non-http address", () => {
    const segs = parseNote("[x](javascript:alert(1))");
    expect(segs.some((s) => s.href)).toBe(false);
    expect(segs.map((s) => s.text).join("")).toContain("x");
  });
  it("leaves HTML as text", () =>
    expect(parseNote("<b>x</b>")).toEqual([{ text: "<b>x</b>" }]));
  it("handles no note", () => {
    expect(parseNote(null)).toEqual([]);
    expect(parseNote("")).toEqual([]);
  });
});

describe("notePlainText", () => {
  it("flattens to plain text", () =>
    expect(notePlainText(closed)).toBe(
      "The servers closed on January 31st, 2024: more info.",
    ));
  it("leaves asterisks and backticks alone", () =>
    expect(notePlainText('"Selfish b******" and Queen`s')).toBe(
      '"Selfish b******" and Queen`s',
    ));
  it("returns null for no note", () => {
    expect(notePlainText("")).toBeNull();
    expect(notePlainText(null)).toBeNull();
  });
});
