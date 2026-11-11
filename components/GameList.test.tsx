// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameList } from "@/components/GameList";
import { SHOW_ALL_SLOT_ID } from "@/components/game-query-string";
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
  coverTileBg: null,
  earnedTotal: 1,
  definedTotal: 2,
  counts: { platinum: [0, 0], gold: [0, 0], silver: [0, 0], bronze: [1, 2] },
  progress: 50,
  rank: "C",
  lastPlayedLine: "",
  status: "incomplete",
  unobtainable: null,
});
const games = (from: number, count: number) => Array.from({ length: count }, (_, i) => game(from + i));

const query: GameQuery = { state: "all", platform: "all", sort: "lastTrophy", q: "", unobtainable: "off", offset: 0 };

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
        query={{ ...query, state: "notFinished", platform: "PS5", sort: "alphabetical", q: "dark souls", unobtainable: "with" }}
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
      unobtainable: "with",
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
    const realScrollTo = window.scrollTo;
    beforeEach(() => {
      scrollTo.mockReset();
      window.scrollTo = scrollTo as never;
      history.replaceState(null, "");
      saveListSnapshot({ key: "k", items: games(1, 120), total: 200, scrollY: 4200 });
    });
    afterEach(() => {
      window.scrollTo = realScrollTo;
      delete (window as { scrollY?: number }).scrollY;
      vi.restoreAllMocks();
    });
    const mount = (key = "k") =>
      render(<GameList snapshotKey={key} initial={{ items: games(1, 50), total: 200 }} query={query} />);

    it("restores the loaded games and the scroll position after a back navigation", async () => {
      // Back to the tagged entry: it is still the current one.
      await act(async () => {
        mount();
      });
      expect(rows()).toBe(120);
      expect(scrollTo).toHaveBeenCalledWith(0, 4200);
    });

    it("restores again after leaving and coming back a second time", async () => {
      await act(async () => {
        mount();
      });
      cleanup();
      await act(async () => {
        mount();
      });
      expect(rows()).toBe(120);
    });

    it("starts from the top on a fresh visit", async () => {
      history.pushState(null, ""); // a new entry, as a menu link would push
      await act(async () => {
        mount();
      });
      expect(rows()).toBe(50);
      expect(scrollTo).not.toHaveBeenCalled();
    });

    it("starts from the top on a fresh visit after a back that mounted no list", async () => {
      window.dispatchEvent(new PopStateEvent("popstate")); // back to a game page: no GameList
      history.pushState(null, ""); // then the Games menu entry
      await act(async () => {
        mount();
      });
      expect(rows()).toBe(50);
      expect(scrollTo).not.toHaveBeenCalled();
    });

    it("ignores a snapshot taken with other filters or before a sync", async () => {
      await act(async () => {
        mount("other");
      });
      expect(rows()).toBe(50);
      expect(scrollTo).not.toHaveBeenCalled();
    });

    it("keeps Next's own history state when tagging the entry", () => {
      history.replaceState({ __NA: true }, "");
      saveListSnapshot({ key: "k", items: games(1, 2), total: 2, scrollY: 1 });
      expect(history.state.__NA).toBe(true);
      expect(history.state.gamesSnapshot).toBeTruthy();
    });

    it("saves the loaded games and scroll position when a game is opened", async () => {
      history.pushState(null, "");
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

    it("does not save on modified or non-primary clicks", async () => {
      mount();
      sessionStorage.clear();
      const link = document.querySelector<HTMLAnchorElement>("a.game")!;
      link.addEventListener("click", (e) => e.preventDefault());
      await act(async () => {
        link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true }));
        link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, metaKey: true }));
        link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, shiftKey: true }));
        link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 1 }));
      });
      expect(sessionStorage.getItem("games-list")).toBeNull();
    });

    it("does not crash when sessionStorage throws", async () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("denied");
      });
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("quota");
      });
      await act(async () => {
        mount();
      });
      expect(rows()).toBe(50);
      const link = document.querySelector<HTMLAnchorElement>("a.game")!;
      link.addEventListener("click", (e) => e.preventDefault());
      await act(async () => link.click());
      expect(rows()).toBe(50);
    });
  });

  describe("Show all", () => {
    let slot: HTMLSpanElement;
    beforeEach(() => {
      slot = document.createElement("span");
      slot.id = SHOW_ALL_SLOT_ID;
      document.body.append(slot);
    });
    afterEach(() => slot.remove());

    const showAll = () => screen.getByRole("button", { name: /Show all|Loading…/ });

    it("offers Show all while games remain", () => {
      render(<GameList snapshotKey="k" initial={{ items: games(1, 50), total: 60 }} query={query} />);
      const button = screen.getByRole("button", { name: "Show all" });
      expect(slot).toContainElement(button);
      expect(button).toBeEnabled();
    });

    it("offers nothing when everything is loaded", () => {
      render(<GameList snapshotKey="k" initial={{ items: games(1, 50), total: 50 }} query={query} />);
      expect(screen.queryByRole("button", { name: "Show all" })).toBeNull();
      expect(slot).toBeEmptyDOMElement();
    });

    it("loads the rest in one request", async () => {
      let resolve!: (r: Response) => void;
      fetchMock.mockReturnValueOnce(new Promise<Response>((r) => (resolve = r)));
      render(<GameList snapshotKey="k" initial={{ items: games(1, 50), total: 60 }} query={query} />);
      await act(async () => showAll().click());
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const url = new URL(String(fetchMock.mock.calls[0][0]), "http://x");
      expect(url.searchParams.get("offset")).toBe("50");
      expect(url.searchParams.get("all")).toBe("1");
      expect(screen.getByRole("button", { name: "Loading…" })).toBeDisabled();

      await act(async () => resolve(reply(games(51, 10), 60)));
      expect(rows()).toBe(60);
      expect(screen.queryByRole("button", { name: /Show all|Loading…/ })).toBeNull();
      expect(screen.queryByText(FOOTER)).toBeNull();
    });

    it("gives the button back when it fails", async () => {
      fetchMock.mockResolvedValueOnce(new Response("{}", { status: 500 }));
      render(<GameList snapshotKey="k" initial={{ items: games(1, 50), total: 60 }} query={query} />);
      await act(async () => showAll().click());
      const button = screen.getByRole("button", { name: "Show all" });
      expect(button).toBeEnabled();
      expect(screen.getByText(/Couldn't load more games\./)).toBeInTheDocument();
      expect(rows()).toBe(50);
    });

    it("makes one request when Show all races with scrolling", async () => {
      fetchMock.mockReturnValueOnce(new Promise<Response>(() => {}));
      render(<GameList snapshotKey="k" initial={{ items: games(1, 50), total: 60 }} query={query} />);
      await intersect();
      await act(async () => showAll().click());
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("makes one request when scrolling races with Show all", async () => {
      let resolve!: (r: Response) => void;
      fetchMock.mockReturnValueOnce(new Promise<Response>((r) => (resolve = r)));
      render(<GameList snapshotKey="k" initial={{ items: games(1, 50), total: 60 }} query={query} />);
      await act(async () => showAll().click());
      await intersect();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await act(async () => resolve(reply(games(51, 10), 60)));
      const ids = [...document.querySelectorAll("a.game")].map((a) => a.getAttribute("href"));
      expect(ids).toHaveLength(60);
      expect(new Set(ids).size).toBe(60);
    });
  });
});
