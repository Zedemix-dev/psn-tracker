import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProfileBand } from "@/components/ProfileBand";
import type { profile } from "@/src/db/schema";
import type { SyncStatus } from "@/src/sync/requests";

vi.mock("@/components/SyncButton", () => ({ SyncButton: () => null }));

describe("ProfileBand", () => {
  const row = {
    onlineId: "Zmx969",
    avatarUrl: null,
    earnedPlatinum: 230,
    earnedGold: 990,
    earnedSilver: 2434,
    earnedBronze: 7976,
    level: null,
    levelProgress: null,
    tier: null,
  } as unknown as typeof profile.$inferSelect;

  it("keeps the counters' markup", () => {
    const html = renderToStaticMarkup(
      <ProfileBand profile={row} imageMap={new Map()} sync={{} as SyncStatus} />,
    );
    expect(html).toContain('<div class="count total"><b>11,630</b><span>Trophies</span></div>');
    expect(html).toMatch(/<div class="count plat"><b>230<\/b><span><.*?>Platinum<\/span><\/div>/);
    expect(html).toMatch(/<div class="count bronze"><b>7,976<\/b><span><.*?>Bronze<\/span><\/div>/);
  });

  it("marks the total counter so phones can give it a full row", () => {
    const html = renderToStaticMarkup(
      <ProfileBand profile={row} imageMap={new Map()} sync={{} as SyncStatus} />,
    );
    expect(html.match(/class="count total"/g)).toHaveLength(1);
  });
});
