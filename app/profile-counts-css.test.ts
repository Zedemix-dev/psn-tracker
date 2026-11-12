import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

/** Bodies of every top-level `@media (max-width:<px>px){…}` block (balanced braces). */
function mediaBlocks(src: string, px: number): string[] {
  const open = `@media (max-width:${px}px){`;
  const out: string[] = [];
  let at = src.indexOf(open);
  while (at >= 0) {
    let depth = 1;
    let j = at + open.length;
    while (j < src.length && depth > 0) {
      if (src[j] === "{") depth++;
      else if (src[j] === "}") depth--;
      j++;
    }
    out.push(src.slice(at + open.length, j - 1));
    at = src.indexOf(open, j);
  }
  return out;
}

const phone = mediaBlocks(css, 640).join("\n");
const narrow = mediaBlocks(css, 360).join("\n");
const ruleIn = (block: string, sel: string) =>
  block.match(new RegExp(`${sel.replace(/[.]/g, "\\.")}\\{([^}]*)\\}`))?.[1] ?? "";
const rule = (sel: string) => ruleIn(phone, sel);

describe("profile counters on phones", () => {
  it("lay out as 4 equal columns with a gap of 6px", () => {
    const r = rule(".counts");
    expect(r).toContain("display:grid");
    expect(r).toContain("grid-template-columns:repeat(4,minmax(0,1fr))");
    expect(r).toContain("gap:6px");
  });

  it("drop the min-width of the four types", () => {
    expect(rule(".counts .count")).toContain("min-width:0");
  });

  it("give the total the full width, on one line", () => {
    const r = rule(".counts .count.total");
    expect(r).toContain("grid-column:1/-1");
    expect(r).toContain("flex-direction:row");
    expect(r).toContain("gap:8px");
    expect(rule(".counts .count.total span")).toContain("margin-top:0");
  });

  it("tighten the gaps below 360px so the Platinum label fits a 320px tile", () => {
    expect(ruleIn(narrow, ".counts")).toContain("gap:4px");
    expect(ruleIn(narrow, ".counts .count span")).toContain("gap:2px");
    expect(css.indexOf("@media (max-width:360px){")).toBeGreaterThan(css.lastIndexOf(".counts .count.total span{"));
  });

  it("change nothing outside the phone block", () => {
    const n = (s: string) => s.split(".count.total").length - 1;
    expect(n(css)).toBe(n(phone));
  });
});
