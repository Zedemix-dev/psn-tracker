import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

// Reads the page sources as text: "Show all" must come after the count in the returned JSX.
it.each([
  ["app/(site)/(banner)/page.tsx", "SHOW_ALL_SLOT_ID", 'className="aside"'],
  ["app/(site)/(banner)/trophy-log/page.tsx", "LOG_SHOW_ALL_SLOT_ID", "shownText("],
  ["app/(site)/(banner)/trophy-advisor/page.tsx", "ADVISOR_SHOW_ALL_SLOT_ID", "shownText("],
])("%s: Show all comes after the count", (file, slot, count) => {
  const source = readFileSync(join(process.cwd(), file), "utf8");
  const jsx = source.slice(source.indexOf("return ("));
  const slotAt = jsx.indexOf(`id={${slot}}`);
  const countAt = jsx.indexOf(count);
  expect(slotAt).toBeGreaterThan(-1);
  expect(countAt).toBeGreaterThan(-1);
  expect(slotAt).toBeGreaterThan(countAt);
});
