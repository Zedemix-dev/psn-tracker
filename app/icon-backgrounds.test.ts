import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// A trophy icon with a transparent background is shown as is: no square behind it.
export const ICON_RULES: [file: string, selector: string][] = [
  ["app/globals.css", ".tlist img"],
  ["app/globals.css", ".ce-list img:first-child"],
  ["app/globals.css", ".game-page .trophy img.ic"],
  ["app/globals.css", ".log-row .ic"],
  ["components/TrophyCarousel.module.css", ".item img"],
];

function rulesFor(file: string, selector: string): string[] {
  const css = readFileSync(join(process.cwd(), file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const bodies: string[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = m[1].split(",").map((s) => s.trim().replace(/\s+/g, " "));
    if (selectors.includes(selector)) bodies.push(m[2]);
  }
  return bodies;
}

describe("trophy icons", () => {
  it.each(ICON_RULES)("%s: no background behind %s", (file, selector) => {
    const bodies = rulesFor(file, selector);
    expect(bodies.length).toBeGreaterThan(0);
    for (const body of bodies) {
      expect(body).not.toMatch(/(^|[;\s])background(-[a-z]+)?\s*:/);
    }
  });
});

describe("Trophy Log rows", () => {
  it("lift content-visibility on the row whose unobtainable tooltip is open", () => {
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
    expect(css).toMatch(/\.log-row:has\(\.unob:hover,\s*\.unob:focus\)\s*\{[^}]*content-visibility:\s*visible/);
  });
});
