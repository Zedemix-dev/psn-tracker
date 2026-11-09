import { readFile } from "node:fs/promises";
import path from "node:path";
import { create, type Font } from "fontkit";

export type TextStyle = { size: number; weight: 400 | 500 | 600 | 700 };
export type TextEngine = {
  measure(text: string, style: TextStyle): number;
  wrap(text: string, style: TextStyle, maxWidth: number, maxLines: number): string[];
  /** One SVG <path>, or "" for an empty text. */
  path(
    text: string,
    style: TextStyle,
    at: { x: number; y: number; anchor?: "start" | "middle" | "end"; fill: string },
  ): string;
};

const WEIGHTS = [400, 500, 600, 700] as const;
const ELLIPSIS = "…";

/**
 * Replaces, character by character, only what the font cannot draw: NFKC if the
 * result is drawable, else NFKD without the accents, else the character is dropped.
 */
export function toDrawable(text: string, has: (codePoint: number) => boolean): string {
  let out = "";
  for (const ch of text) {
    if (has(ch.codePointAt(0)!)) {
      out += ch;
      continue;
    }
    const nfkc = ch.normalize("NFKC");
    if (nfkc !== "" && [...nfkc].every((c) => has(c.codePointAt(0)!))) {
      out += nfkc;
      continue;
    }
    const base = ch.normalize("NFKD").replace(/\p{M}/gu, "");
    if (base !== "" && [...base].every((c) => has(c.codePointAt(0)!))) out += base;
  }
  return out;
}

function buildEngine(fonts: Map<number, Font>): TextEngine {
  const fontFor = (style: TextStyle) => fonts.get(style.weight) ?? fonts.get(400)!;
  const drawable = (text: string, font: Font) =>
    toDrawable(text, (cp) => font.hasGlyphForCodePoint(cp));

  const measureRaw = (text: string, style: TextStyle) => {
    const font = fontFor(style);
    const scale = style.size / font.unitsPerEm;
    let width = 0;
    for (const p of font.layout(text).positions) width += p.xAdvance * scale;
    return width;
  };
  const measure = (text: string, style: TextStyle) =>
    measureRaw(drawable(text, fontFor(style)), style);

  /** Longest prefix of `word` (at least one character) that fits. */
  const fitPrefix = (word: string, style: TextStyle, maxWidth: number) => {
    const chars = [...word];
    let n = 1;
    while (n < chars.length && measureRaw(chars.slice(0, n + 1).join(""), style) <= maxWidth) n++;
    return chars.slice(0, n).join("");
  };

  const wrap = (text: string, style: TextStyle, maxWidth: number, maxLines: number) => {
    const clean = drawable(text, fontFor(style)).replace(/\s+/g, " ").trim();
    if (clean === "" || maxLines < 1) return [];
    const lines: string[] = [];
    let current = "";
    for (let word of clean.split(" ")) {
      while (true) {
        const candidate = current === "" ? word : `${current} ${word}`;
        if (measureRaw(candidate, style) <= maxWidth) {
          current = candidate;
          break;
        }
        if (current !== "") {
          lines.push(current);
          current = "";
          continue;
        }
        // A word wider than a whole line: cut it.
        const head = fitPrefix(word, style, maxWidth);
        lines.push(head);
        word = word.slice(head.length);
        if (word === "") break;
      }
    }
    if (current !== "") lines.push(current);
    if (lines.length <= maxLines) return lines;

    const kept = lines.slice(0, maxLines - 1);
    const chars = [...lines.slice(maxLines - 1).join(" ")];
    while (chars.length > 0 && measureRaw(chars.join("").trimEnd() + ELLIPSIS, style) > maxWidth) {
      chars.pop();
    }
    kept.push(chars.join("").trimEnd() + ELLIPSIS);
    return kept;
  };

  const pathFn: TextEngine["path"] = (text, style, at) => {
    const font = fontFor(style);
    const clean = drawable(text, font);
    if (clean === "") return "";
    const scale = style.size / font.unitsPerEm;
    const { glyphs, positions } = font.layout(clean);
    const total = positions.reduce((sum, p) => sum + p.xAdvance * scale, 0);
    let pen = at.x - (at.anchor === "middle" ? total / 2 : at.anchor === "end" ? total : 0);
    let d = "";
    glyphs.forEach((glyph, i) => {
      const p = positions[i];
      const segment = glyph.path
        .scale(scale, -scale)
        .translate(pen + p.xOffset * scale, at.y - p.yOffset * scale)
        .toSVG();
      if (segment) d += segment;
      pen += p.xAdvance * scale;
    });
    return d === "" ? "" : `<path d="${d}" fill="${at.fill}"/>`;
  };

  return { measure, wrap, path: pathFn };
}

let cached: Promise<TextEngine> | null = null;

/** Reads public/fonts from process.cwd(); loaded once. */
export function loadTextEngine(): Promise<TextEngine> {
  cached ??= (async () => {
    const buffer = await readFile(path.join(process.cwd(), "public", "fonts", "Sora-Variable.ttf"));
    const base = create(buffer) as Font;
    const fonts = new Map<number, Font>();
    for (const wght of WEIGHTS) fonts.set(wght, base.getVariation({ wght }));
    return buildEngine(fonts);
  })().catch((error) => {
    cached = null;
    throw error;
  });
  return cached;
}
