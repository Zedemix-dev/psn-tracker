import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

/** The css without its `@media (hover:hover){…}` blocks (balanced braces). */
function withoutHoverMedia(src: string): string {
  const open = "@media (hover:hover){";
  let out = "";
  let i = 0;
  while (i < src.length) {
    const at = src.indexOf(open, i);
    if (at < 0) return out + src.slice(i);
    out += src.slice(i, at);
    let depth = 1;
    let j = at + open.length;
    while (j < src.length && depth > 0) {
      if (src[j] === "{") depth++;
      else if (src[j] === "}") depth--;
      j++;
    }
    i = j;
  }
  return out;
}

describe("Stats hover styles", () => {
  it("only apply on devices that can hover, so a finger does not leave them stuck", () => {
    const rest = withoutHoverMedia(css);
    for (const sel of [".st-cell:not(.out):hover", "circle.seg:hover"]) {
      expect(css).toContain(sel);
      expect(rest).not.toContain(sel);
    }
  });

  it.each([".st-chart", ".st-donut-svg", ".st-cal"])("%s cannot be selected nor long-pressed", (sel) => {
    const rule = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => m[1].split(",").map((s) => s.trim()).includes(sel) && m[2].includes("user-select:none"));
    expect(rule?.[2]).toContain("-webkit-touch-callout:none");
  });

  it("chart texts let the pointer through to the marks under them", () => {
    expect(css).toMatch(/\.st-chart text\{[^}]*pointer-events:none/);
  });
});
