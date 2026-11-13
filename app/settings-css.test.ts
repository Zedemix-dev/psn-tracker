import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

// Reads the stylesheet as text: a long file name must wrap instead of widening the page.
it("the chosen file name wraps anywhere", () => {
  const css = readFileSync(join(process.cwd(), "app/styles/settings.css"), "utf8");
  const rule = css.split("\n").find((l) => l.startsWith(".set-file-name{"));
  expect(rule).toContain("overflow-wrap:anywhere");
});
