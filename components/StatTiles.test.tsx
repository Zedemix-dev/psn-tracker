import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StatTiles } from "@/components/StatTiles";

describe("StatTiles", () => {
  it("writes the total of games small, after a space", () => {
    const html = renderToStaticMarkup(
      <StatTiles
        stats={{
          gamesCompleted: 224,
          totalGames: 265,
          completionRate: 93.81,
          averageRarity: 26.55,
          unearned: 768,
          trophiesPerDay: 3.19,
          hoursSeconds: 3600,
        }}
      />,
    );
    expect(html).toContain('<div class="value">224 <small>/ 265</small></div>');
    expect(html).toContain('<div class="label">Hours played</div><div class="value">1 h</div>');
  });
});
