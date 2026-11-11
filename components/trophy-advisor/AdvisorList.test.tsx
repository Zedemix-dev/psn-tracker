// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdvisorList } from "@/components/trophy-advisor/AdvisorList";
import type { AdvisorRow } from "@/src/trophy-advisor/load";
import { DEFAULT_ADVISOR_QUERY } from "@/src/trophy-advisor/query";

const trophy = (n: number): AdvisorRow => ({
  key: `NPWR1_00:${n}`,
  name: `Trophy ${n}`,
  detail: "Do it.",
  iconSrc: "/media/icon.png",
  type: "bronze",
  gameId: "NPWR1_00",
  gameName: "The Game",
  gameSrc: "/media/game.png",
  gameIsIcon: false,
  dlc: null,
  platforms: ["PS5"],
  counter: null,
  ratePct: "4.60%",
  tier: "Ultra rare",
  unobtainable: false,
  unobtainableNote: null,
});
const trophies = (from: number, count: number) => Array.from({ length: count }, (_, i) => trophy(from + i));

let trigger: () => void = () => {};
class FakeObserver {
  constructor(private cb: IntersectionObserverCallback) {}
  observe() {
    trigger = () => this.cb([{ isIntersecting: true } as IntersectionObserverEntry], this as never);
  }
  disconnect() {}
  unobserve() {}
}
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  sessionStorage.clear();
});

describe("AdvisorList", () => {
  it("asks /api/trophy-advisor with the filters of the list", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ items: trophies(51, 10), total: 60 }), { status: 200 }),
    );
    const { container } = render(
      <AdvisorList
        snapshotKey="k"
        initial={{ items: trophies(1, 50), total: 60 }}
        query={{ ...DEFAULT_ADVISOR_QUERY, sort: "alphabetical", order: "desc", platform: "PS5" }}
        empty="Nothing left to earn."
      />,
    );
    expect(container.querySelectorAll(".log-row")).toHaveLength(50);
    await act(async () => trigger());
    expect(fetchMock).toHaveBeenCalledWith("/api/trophy-advisor?sort=alphabetical&order=desc&platform=PS5&offset=50");
    expect(container.querySelectorAll(".log-row")).toHaveLength(60);
  });
});
