import { beforeAll, describe, expect, it } from "vitest";
import { loadTextEngine, toDrawable, type TextEngine } from "./text";

const latin = (cp: number) => cp < 0x2000 || cp === 0x2122;

describe("toDrawable", () => {
  it.each([
    ["Ⅱ", "II"],
    ["Ⅻ", "XII"],
    ["～", "~"],
    ["ō", "o"],
    ["a漢b", "ab"],
  ])("replaces %s", (from, to) => expect(toDrawable(from, (cp) => cp < 0x100)).toBe(to));

  it("keeps what the font has", () => expect(toDrawable("Hades™ ō", latin)).toBe("Hades™ ō"));
});

describe("text engine", () => {
  let engine: TextEngine;
  beforeAll(async () => {
    engine = await loadTextEngine();
  });
  const regular = { size: 21, weight: 400 } as const;

  it("makes bold wider than regular", () => {
    expect(engine.measure("Zmx969", { size: 21, weight: 700 })).toBeGreaterThan(
      engine.measure("Zmx969", { size: 21, weight: 400 }),
    );
  });

  it("sets tabular digits on demand, as font-variant-numeric does on the site", () => {
    const proportional = { size: 17, weight: 700 } as const;
    const tabular = { ...proportional, tabular: true };
    expect(engine.measure("11,630", tabular)).toBeCloseTo(62.08, 1);
    expect(engine.measure("11,630", proportional)).toBeLessThan(engine.measure("11,630", tabular));
    const at = { x: 0, y: 20, fill: "#fff" };
    expect(engine.path("1", tabular, at)).not.toBe(engine.path("1", proportional, at));
  });

  it("draws ō with the real font", () => {
    const at = { x: 0, y: 20, fill: "#fff" };
    expect(engine.path("Yōtei", regular, at)).not.toBe(engine.path("Yotei", regular, at));
  });

  it("wraps a long name in 3 lines with an ellipsis", () => {
    const lines = engine.wrap(
      "SpongeBob SquarePants: Battle for Bikini Bottom: Rehydrated",
      regular,
      186,
      3,
    );
    expect(lines).toHaveLength(3);
    expect(lines[2].endsWith("…")).toBe(true);
    for (const l of lines) expect(engine.measure(l, regular)).toBeLessThanOrEqual(186);
  });

  it("splits a word too long for the line", () => {
    const lines = engine.wrap("A".repeat(80), regular, 186, 3);
    expect(lines.length).toBeLessThanOrEqual(3);
    for (const l of lines) expect(engine.measure(l, regular)).toBeLessThanOrEqual(186);
  });

  it("draws text with markup characters as plain paths", () => {
    expect(engine.path("A&B<C", regular, { x: 0, y: 20, fill: "#fff" })).toMatch(
      /^<path d="M[^"&<]+" fill="#fff"\/>$/,
    );
  });

  it("returns nothing for an empty text", () => {
    expect(engine.path("", regular, { x: 0, y: 20, fill: "#fff" })).toBe("");
  });

  it("anchors the text by its middle and end", () => {
    const w = engine.measure("Hello", regular);
    const start = engine.path("Hello", regular, { x: 100, y: 20, fill: "#fff" });
    const end = engine.path("Hello", regular, { x: 100, y: 20, anchor: "end", fill: "#fff" });
    expect(end).not.toBe(start);
    expect(w).toBeGreaterThan(0);
  });
});
