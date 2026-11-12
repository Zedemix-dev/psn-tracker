import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { globSync, readFileSync } from "node:fs";
import path from "node:path";

const root = import.meta.dirname;
const exclude = ["**/node_modules/**", "**/.next/**", "**/dist/**", "**/.data/**"];

/** Files that opt into the DOM with `// @vitest-environment jsdom`. */
const jsdomFiles = globSync("**/*.test.{ts,tsx}", {
  cwd: root,
  exclude: (name) => ["node_modules", ".next", "dist", ".data", ".git"].includes(name),
})
  .map((f) => f.replaceAll("\\", "/"))
  .filter((f) => /^\s*\/\/\s*@vitest-environment jsdom/m.test(readFileSync(path.join(root, f), "utf8")))
  .sort();

/**
 * Files that run in a worker shared with other files (`isolate: false`). Each one was
 * read: no `vi.mock`, `vi.stubGlobal`/`stubEnv`, fake timers, `process.env`, database,
 * or module-level state of its own or of what it imports. When in doubt, a file stays
 * isolated (the default); everything not listed here is isolated.
 */
const sharedNode = [
  "app/icon-backgrounds.test.ts",
  "app/profile-counts-css.test.ts",
  "app/show-all-order.test.ts",
  "app/stats-hover.test.ts",
  "components/game-query-string.test.ts",
  "src/games/banner-overrides.test.ts",
  "src/games/detail-stats.test.ts",
  "src/games/row.test.ts",
  "src/games/trophy-view.test.ts",
  "src/lib/crypto.test.ts",
  "src/lib/earned-order.test.ts",
  "src/lib/escape-like.test.ts",
  "src/lib/format.test.ts",
  "src/lib/guide-links.test.ts",
  "src/lib/pick.test.ts",
  "src/lib/rarity.test.ts",
  "src/lib/span.test.ts",
  "src/lib/tile-bg.test.ts",
  "src/plat-wall/export-layout.test.ts",
  "src/plat-wall/query.test.ts",
  "src/plat-wall/text.test.ts",
  "src/settings/banner.test.ts",
  "src/stats/chart-geometry.test.ts",
  "src/stats/game-charts.test.ts",
  "src/stats/level-history.test.ts",
  "src/stats/publisher-names.test.ts",
  "src/stats/stat-tile-values.test.ts",
  "src/stats/trophy-charts.test.ts",
  "src/sync/diff.test.ts",
  "components/AuthBanner.test.tsx",
  "components/StatTiles.test.tsx",
];

/**
 * jsdom component files that share a worker: they clean up after themselves and use no
 * `vi.mock`, `vi.stubGlobal`, or fake timers. The jsdom files not listed stay isolated.
 */
const sharedJsdom = [
  "components/Banner.test.tsx",
  "components/GameRow.test.tsx",
  "components/RarityBreakdown.test.tsx",
  "components/TileImage.test.tsx",
  "components/game/GameInfoPanel.test.tsx",
  "components/game/TimelinePanel.test.tsx",
  "components/game/TrophyList.test.tsx",
  "components/plat-wall/ExportPreview.test.tsx",
  "components/plat-wall/PlatGrid.test.tsx",
  "components/stats/BarList.test.tsx",
  "components/stats/ChartTip.test.tsx",
  "components/stats/ColumnChart.test.tsx",
  "components/stats/DonutCard.test.tsx",
  "components/stats/LevelHistory.test.tsx",
  "components/stats/StatsCalendar.test.tsx",
  "components/stats/StatsPanels.test.tsx",
  "components/stats/TimeCharts.test.tsx",
  "components/trophy-log/log-snapshot.test.ts",
];

const shared = new Set([...sharedNode, ...sharedJsdom]);
const jsdomIsolated = jsdomFiles.filter((f) => !shared.has(f));
const nodeIsolated = globSync("**/*.test.{ts,tsx}", {
  cwd: root,
  exclude: (name) => ["node_modules", ".next", "dist", ".data", ".git"].includes(name),
})
  .map((f) => f.replaceAll("\\", "/"))
  .filter((f) => !shared.has(f) && !jsdomFiles.includes(f))
  .sort();

const common = {
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(root, ".") } },
};
const base = { testTimeout: 20000, hookTimeout: 20000, exclude };

export default defineConfig({
  test: {
    projects: [
      { ...common, test: { ...base, name: "node", environment: "node", include: nodeIsolated } },
      { ...common, test: { ...base, name: "node-shared", environment: "node", isolate: false, include: sharedNode } },
      { ...common, test: { ...base, name: "jsdom", environment: "jsdom", include: jsdomIsolated } },
      { ...common, test: { ...base, name: "jsdom-shared", environment: "jsdom", isolate: false, include: sharedJsdom } },
    ],
  },
});
