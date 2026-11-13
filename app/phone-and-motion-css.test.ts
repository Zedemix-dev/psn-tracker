import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
const squash = (text: string) =>
  text
    .replace(/\s+/g, " ")
    .replace(/ ?([{}:;,>]) ?/g, "$1")
    .trim();

// Text of every top-level `@media (<query>){...}` block of a CSS file, whitespace removed.
function mediaBlocks(css: string, query: string): string {
  const flat = squash(css);
  const head = `@media (${query}){`;
  let out = "";
  let from = 0;
  for (;;) {
    const start = flat.indexOf(head, from);
    if (start === -1) return out;
    let depth = 1;
    let i = start + head.length;
    for (; i < flat.length && depth > 0; i++) {
      if (flat[i] === "{") depth++;
      else if (flat[i] === "}") depth--;
    }
    out += flat.slice(start + head.length, i - 1);
    from = i;
  }
}

const phone = (file: string) => mediaBlocks(read(file), "max-width:640px");
const reduced = (file: string) => mediaBlocks(read(file), "prefers-reduced-motion:reduce");

describe("D7: Games header on two lines below 640 px", () => {
  it("only the Games head carries games-head", () => {
    expect(read("app/(site)/(banner)/page.tsx")).toContain('className="panel-head games-head"');
  });
  it("wraps, and flattens the two groups so the toggle drops to its own line", () => {
    const css = phone("app/globals.css");
    expect(css).toContain(".games-head{flex-wrap:wrap;justify-content:flex-start;column-gap:10px;row-gap:4px}");
    expect(css).toContain(".games-head .ph-left,.games-head .head-right{display:contents}");
    expect(css).toMatch(/\.games-head::after\{[^}]*order:4/);
    expect(css).toMatch(/\.games-head::after\{[^}]*flex-basis:100%/);
    expect(css).toMatch(/\.games-head \.toggle\{[^}]*order:5/);
    expect(css).not.toMatch(/\.games-head \.toggle\{[^}]*flex-basis/);
    expect(css).toMatch(/\.games-head \.head-right>span:not\(\.aside\)\{[^}]*margin-left:auto/);
  });
});

describe("D3: 32 px touch zones below 640 px", () => {
  it("extends the three buttons with an invisible ::after", () => {
    const css = phone("app/globals.css");
    expect(css).toMatch(
      /\.btn-sync::after,\.show-all::after,\.edit-btn::after\{[^}]*position:absolute[^}]*height:max\(100%,32px\)/,
    );
    expect(css).toMatch(/\.btn-sync,\.show-all,\.edit-btn\{position:relative\}/);
  });
});

describe("D6: reduced motion", () => {
  it("drops every transition and the sync spinner", () => {
    const css = reduced("app/globals.css");
    expect(css).toContain("*,*::before,*::after{transition:none!important}");
    expect(css).toContain(".btn-sync.busy svg{animation:none}");
  });
  it("stops the .spin loader", () => {
    expect(reduced("app/styles/plat-wall.css")).toContain(".spin{animation:none}");
  });
});

describe("tab strip", () => {
  it("keeps focused tabs clear of the 32 px fade", () => {
    expect(squash(read("app/globals.css"))).toMatch(/\.tabs\{[^}]*scroll-padding-inline:32px/);
  });
});
