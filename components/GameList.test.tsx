// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameList } from "@/components/GameList";
import { saveListSnapshot } from "@/components/list-snapshot";
import type { GameQuery } from "@/src/games/query";
import type { GameRowData } from "@/src/games/row";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

const game = (n: number): GameRowData => ({
  id: `NPWR${n}`,
  name: `Game ${n}`,
  platforms: ["PS5"],
  coverSrc: "/c.png",
  coverIsIcon: false,
  earnedTotal: 1,
  definedTotal: 2,
  counts: { platinum: [0, 0], gold: [0, 0], silver: [0, 0], bronze: [1, 2] },
  progress: 50,
  rank: "C",
  lastPlayedLine: "",
  status: "incomplete",
});
const games = (from: number, count: number) => Array.from({ length: count }, (_, i) => game(from + i));

const query: GameQuery = { state: "all", platform: "all", sort: "lastTrophy", q: "", offset: 0 };

let trigger: () => void = () => {};
let observed = 0;
let observerOptions: IntersectionObserverInit | undefined;
class FakeObserver {
  constructor(
    private cb: IntersectionObserverCallback,
    options?: IntersectionObserverInit,
  ) {
    observerOptions = options;
  }
  observe() {
    observed++;
    trigger = () => this.cb([{ isIntersecting: true } as IntersectionObserverEntry], this as never);
  }
  disconnect() {
    trigger = () => {};
  }
  unobserve() {}
}

const fetchMock = vi.fn<typeof fetch>();
const reply = (items: GameRowData[], total: number) =>
  new Response(JSON.stringify({ items, total }), { status: 200 });
const intersect = () => act(async () => trigger());

beforeEach(() => {
  observed = 0;
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  sessionStorage.clear();
});

const rows = () => document.querySelectorAll(".game").length;
const FOOTER = "The next 50 games load as you scroll down";

describe("GameList", () => {
  it("loads the next page on intersection, appends it, then stops at total", async () => {
    fetchMock.mockResolvedValueOnce(reply(games(51, 20), 70));
    render(<GameList snapshotKey="k" initial={{ items: games(1, 50), total: 70 }} query={query} />);
    expect(rows()).toBe(50);
    expect(screen.getByText(FOOTER)).toBeInTheDocument();

    await intersect();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/games?offset=50");
    expect(rows()).toBe(70);
    expect(screen.queryByText(FOOTER)).toBeNull();

    // Everything is loaded: no observer left to fire, no further fetch.
    expect(() => trigger()).not.toThrow();
    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("also loads when the footer was scrolled past, and a bit before it shows", () => {
    // Jumping to the page bottom (End key, scrollbar drag) can leave the footer above the
    // viewport without ever crossing it: the root is extended far upwards, and 600 px down.
    render(<GameList snapshotKey="k" initial={{ items: games(1, 50), total: 70 }} query={query} />);
    expect(observerOptions?.rootMargin).toBe("100000px 0px 600px 0px");
  });

  it("says so when no game matches", () => {
    render(<GameList snapshotKey="k" initial={{ items: [], total: 0 }} query={query} empty="No games match these filters." />);
    expect(screen.getByText("No games match these filters.")).toBeInTheDocument();
    expect(screen.queryByText(FOOTER)).toBeNull();
  });

  it("sends the current filters along with the offset", async () => {
    fetchMock.mockResolvedValueOnce(reply(games(51, 1), 51));
    render(
      <GameList
        snapshotKey="k"
        initial={{ items: games(1, 50), total: 51 }}
        query={{ ...query, state: "notFinished", platform: "PS5", sort: "alphabetical", q: "dark souls" }}
      />,
    );
    await intersect();
    const url = new URL(String(fetchMock.mock.calls[0][0]), "http://x");
    expect(url.pathname).toBe("/api/games");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      state: "notFinished",
      platform: "PS5",
      sort: "alphabetical",
      q: "dark souls",
      offset: "50",
    });
  });

  it("never runs two fetches at once", async () => {
    let resolve!: (r: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((r) => (resolve = r)));
    render(<GameList snapshotKey="k" initial={{ items: games(1, 50), total: 100 }} query={query} />);
    await intersect();
    await intersect();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => resolve(reply(games(51, 50), 100)));
    expect(rows()).toBe(100);
  });

  it("does not observe anything when the first page already holds every game", () => {
    render(<GameList snapshotKey="k" initial={{ items: games(1, 3), total: 3 }} query={query} />);
    expect(observed).toBe(0);
    expect(screen.queryByText(FOOTER)).toBeNull();
  });

  it("offers a retry after a failed fetch and appends on success", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    render(<GameList snapshotKey="k" initial={{ items: games(1, 50), total: 60 }} query={query} />);
    await intersect();
    expect(screen.getByText(/Couldn't load more games\./)).toBeInTheDocument();
    expect(rows()).toBe(50);

    fetchMock.mockResolvedValueOnce(reply(games(51, 10), 60));
    await act(async () => screen.getByRole("button", { name: "Retry" }).click());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(rows()).toBe(60);
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("does not duplicate a game already shown", async () => {
    fetchMock.mockResolvedValueOnce(reply([game(50), ...games(51, 2)], 52));
    render(<GameList snapshotKey="k" initial={{ items: games(1, 50), total: 52 }} query={query} />);
    await intersect();
    expect(rows()).toBe(52);
  });

  describe("coming back from a game page", () => {
    const scrollTo = vi.fn();
    beforeEach(() => {
      scrollTo.mockReset();
      window.scrollTo = scrollTo as never;
      saveListSnapshot({ key: "k", items: games(1, 120), total: 200, scrollY: 4200 });
    });
    const mount = () => render(<GameList snapshotKey="k" initial={{ items: games(1, 50), total: 200 }} query={query} />);

    it("restores the loaded games and the scroll position after a back navigation", async () => {
      window.dispatchEvent(new PopStateEvent("popstate"));
      await act(async () => {
        mount();
      });
      expect(rows()).toBe(120);
      expect(scrollTo).toHaveBeenCalledWith(0, 4200);
    });

    it("starts from the top on a fresh visit", async () => {
      await act(async () => {
        mount();
      });
      expect(rows()).toBe(50);
      expect(scrollTo).not.toHaveBeenCalled();
      expect(sessionStorage.getItem("games-list")).toBeNull();
    });

    it("ignores a snapshot taken with other filters or before a sync", async () => {
      window.dispatchEvent(new PopStateEvent("popstate"));
      await act(async () => {
        render(<GameList snapshotKey="other" initial={{ items: games(1, 50), total: 200 }} query={query} />);
      });
      expect(rows()).toBe(50);
      expect(scrollTo).not.toHaveBeenCalled();
    });

    it("saves the loaded games and scroll position when a game is opened", async () => {
      mount();
      sessionStorage.clear();
      Object.defineProperty(window, "scrollY", { value: 900, configurable: true });
      const link = document.querySelector<HTMLAnchorElement>("a.game")!;
      link.addEventListener("click", (e) => e.preventDefault());
      await act(async () => link.click());
      const saved = JSON.parse(sessionStorage.getItem("games-list")!);
      expect(saved).toMatchObject({ key: "k", total: 200, scrollY: 900 });
      expect(saved.items).toHaveLength(50);
    });
  });
});
