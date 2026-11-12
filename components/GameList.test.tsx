// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameList, gamePlaces } from "@/components/GameList";
import { SHOW_ALL_SLOT_ID } from "@/components/game-query-string";
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

// A controllable requestAnimationFrame: callbacks wait until a test runs them.
let frames = new Map<number, FrameRequestCallback>();
let nextFrame = 1;
const fakeFrames = () => {
  frames = new Map();
  nextFrame = 1;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    frames.set(nextFrame, cb);
    return nextFrame++;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
};
const runFrame = () =>
  act(async () => {
    const [id, cb] = [...frames][0];
    frames.delete(id);
    cb(0);
  });

const rows = () => document.querySelectorAll(".game").length;
const FOOTER = "The next 50 games load as you scroll down";

/**
 * Mounts the way a Back navigation does in the browser: outside act, React doing its work in its
 * own tasks. `paints` is the page as the browser could paint it after each task (a MutationObserver
 * callback runs once per task, before any paint): rows shown, top of `paintedRow`, Loading…, footer.
 */
async function mountOutsideAct(ui: ReactElement, paintedRow: string) {
  const env = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const actEnvironment = env.IS_REACT_ACT_ENVIRONMENT;
  const host = document.body.appendChild(document.createElement("div"));
  const paints: { rows: number; top: number | null; loading: boolean; footer: boolean }[] = [];
  const observer = new MutationObserver(() => {
    const text = document.body.textContent ?? "";
    const row = document.querySelector<HTMLElement>(`a.game[data-key="${paintedRow}"]`);
    paints.push({
      rows: rows(),
      top: row ? row.getBoundingClientRect().top : null,
      loading: text.includes("Loading…"),
      footer: text.includes(FOOTER),
    });
  });
  env.IS_REACT_ACT_ENVIRONMENT = false;
  const root = createRoot(host);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  root.render(ui);
  await new Promise((resolve) => setTimeout(resolve, 50));
  observer.disconnect();
  return {
    paints,
    unmount() {
      root.unmount();
      host.remove();
      env.IS_REACT_ACT_ENVIRONMENT = actEnvironment;
    },
  };
}

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

  it("keeps loading after a page made only of games already shown", async () => {
    fetchMock.mockResolvedValueOnce(reply(games(1, 50), 120));
    render(<GameList snapshotKey="k" initial={{ items: games(1, 50), total: 120 }} query={query} />);
    await intersect();
    expect(rows()).toBe(50);
    expect(screen.getByText(FOOTER)).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(reply(games(51, 50), 120));
    await intersect();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new URL(String(fetchMock.mock.calls[1][0]), "http://x").searchParams.get("offset")).toBe("100");
    expect(rows()).toBe(100);
  });

  it("stops when the server has nothing more to give", async () => {
    fetchMock.mockResolvedValueOnce(reply([], 120));
    render(<GameList snapshotKey="k" initial={{ items: games(1, 50), total: 120 }} query={query} />);
    await intersect();
    expect(screen.queryByText(FOOTER)).toBeNull();
  });

  describe("coming back from a game page", () => {
    const scrollTo = vi.fn();
    const realScrollTo = window.scrollTo;
    beforeEach(() => {
      scrollTo.mockReset();
      window.scrollTo = scrollTo as never;
      history.replaceState(null, "");
    });
    afterEach(() => {
      window.scrollTo = realScrollTo;
      delete (window as { scrollY?: number }).scrollY;
      vi.restoreAllMocks();
    });
    const mount = (key = "k", total = 200) =>
      render(<GameList snapshotKey={key} initial={{ items: games(1, 50), total }} query={query} />);

    // The fallback: the rows were not kept (an older snapshot, or they did not fit) and are fetched.
    describe("with a saved place but no kept rows", () => {
      beforeEach(() => gamePlaces.save({ key: "k", loaded: 120, scrollY: 4200 }));

      it("falls back to the limit fetch when the kept rows do not read back", async () => {
        sessionStorage.setItem("games-list:rows", "{not json");
        fetchMock.mockResolvedValueOnce(reply(games(1, 120), 200));
        await act(async () => {
          mount();
        });
        expect(fetchMock).toHaveBeenCalledWith("/api/games?offset=0&limit=120");
        expect(rows()).toBe(120);
      });

      it("restores the loaded games and the scroll position after a back navigation", async () => {
        // Back to the tagged entry: it is still the current one. The rows are fetched again.
        fetchMock.mockResolvedValueOnce(reply(games(1, 120), 200));
        await act(async () => {
          mount();
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith("/api/games?offset=0&limit=120");
        expect(rows()).toBe(120);
        expect(scrollTo).toHaveBeenCalledWith(0, 4200);
      });

      it("restores with the filters of the list", async () => {
        fetchMock.mockResolvedValueOnce(reply(games(1, 120), 200));
        await act(async () => {
          render(
            <GameList
              snapshotKey="k"
              initial={{ items: games(1, 50), total: 200 }}
              query={{ ...query, state: "platinum", platform: "PS4", q: "souls" }}
            />,
          );
        });
        expect(fetchMock).toHaveBeenCalledWith("/api/games?state=platinum&platform=PS4&q=souls&offset=0&limit=120");
      });

      it("restores again after leaving and coming back a second time", async () => {
        fetchMock.mockResolvedValueOnce(reply(games(1, 120), 200)).mockResolvedValueOnce(reply(games(1, 120), 200));
        await act(async () => {
          mount();
        });
        cleanup();
        await act(async () => {
          mount();
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(rows()).toBe(120);
      });

      it("starts from the top on a fresh visit", async () => {
        history.pushState(null, ""); // a new entry, as a menu link would push
        await act(async () => {
          mount();
        });
        expect(fetchMock).not.toHaveBeenCalled();
        expect(rows()).toBe(50);
        expect(scrollTo).not.toHaveBeenCalled();
      });

      it("starts from the top on a fresh visit after a back that mounted no list", async () => {
        window.dispatchEvent(new PopStateEvent("popstate")); // back to a game page: no GameList
        history.pushState(null, ""); // then the Games menu entry
        await act(async () => {
          mount();
        });
        expect(fetchMock).not.toHaveBeenCalled();
        expect(rows()).toBe(50);
        expect(scrollTo).not.toHaveBeenCalled();
      });

      it("ignores a snapshot taken with other filters or before a sync", async () => {
        await act(async () => {
          mount("other");
        });
        expect(fetchMock).not.toHaveBeenCalled();
        expect(rows()).toBe(50);
        expect(scrollTo).not.toHaveBeenCalled();
      });

      it("keeps the first page when the restore fails", async () => {
        fetchMock.mockRejectedValueOnce(new Error("offline"));
        await act(async () => {
          mount();
        });
        expect(rows()).toBe(50);
        expect(scrollTo).not.toHaveBeenCalled();
        expect(screen.getByText(FOOTER)).toBeInTheDocument();
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
        expect(fetchMock).not.toHaveBeenCalled();
        expect(rows()).toBe(50);
        const link = document.querySelector<HTMLAnchorElement>("a.game")!;
        link.addEventListener("click", (e) => e.preventDefault());
        await act(async () => link.click());
        expect(rows()).toBe(50);
      });
    });

    it("keeps Next's own history state when tagging the entry", () => {
      history.replaceState({ __NA: true }, "");
      gamePlaces.save({ key: "k", loaded: 2, scrollY: 1 });
      expect(history.state.__NA).toBe(true);
      expect(history.state.gamesSnapshot).toBeTruthy();
    });

    it("saves the loaded games, the offset and the scroll position when a game is opened", async () => {
      history.pushState(null, "");
      mount();
      sessionStorage.clear();
      Object.defineProperty(window, "scrollY", { value: 900, configurable: true });
      const link = document.querySelector<HTMLAnchorElement>("a.game")!;
      link.addEventListener("click", (e) => e.preventDefault());
      await act(async () => link.click());
      const place = JSON.parse(sessionStorage.getItem("games-list")!);
      expect(place).toMatchObject({ key: "k", loaded: 50, scrollY: 900 });
      expect(place.items).toBeUndefined();
      // The rows in their own entry, tied to the place.
      const kept = JSON.parse(sessionStorage.getItem("games-list:rows")!);
      expect(kept).toMatchObject({ id: place.id, total: 200, offset: 50, exhausted: false });
      expect(kept.items).toEqual(games(1, 50));
    });

    it("keeps the place without the rows when they do not fit, and Back fetches them", async () => {
      history.pushState(null, "");
      Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
      const setItem = Storage.prototype.setItem;
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
        if (key.endsWith(":rows")) throw new DOMException("Full", "QuotaExceededError");
        setItem.call(this, key, value);
      });
      mount();
      const link = document.querySelector<HTMLAnchorElement>("a.game")!;
      link.addEventListener("click", (e) => e.preventDefault());
      await act(async () => link.click());
      expect(JSON.parse(sessionStorage.getItem("games-list")!)).toMatchObject({ key: "k", loaded: 50 });
      expect(sessionStorage.getItem("games-list:rows")).toBeNull();

      cleanup();
      fetchMock.mockResolvedValueOnce(reply(games(1, 50), 200));
      await act(async () => {
        mount();
      });
      expect(fetchMock).toHaveBeenCalledWith("/api/games?offset=0&limit=50");
      expect(rows()).toBe(50);
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
      expect(sessionStorage.getItem("games-list:rows")).toBeNull();
    });

    describe("back to the same rows and the same row at the top", () => {
      // A tiny layout: game n sits at document y `above + (n - 1) * 80`; its rect follows the scroll.
      let y = 0;
      let above = 0;
      beforeEach(() => {
        fakeFrames();
        y = 0;
        above = 0;
        scrollTo.mockImplementation(((_x: number, to: number) => {
          y = to;
        }) as never);
        Object.defineProperty(window, "scrollY", { get: () => y, configurable: true });
        vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
          const top = above + (Number(this.dataset.key?.slice("NPWR".length) ?? 0) - 1) * 80 - y;
          return { top, bottom: top + 80 } as DOMRect;
        });
        history.pushState(null, ""); // a fresh visit: nothing to restore on the first mount
      });
      const hrefs = () => [...document.querySelectorAll("a.game")].map((a) => a.getAttribute("href"));
      const rowTop = (n: number) =>
        document.querySelector<HTMLElement>(`a.game[data-key="NPWR${n}"]`)!.getBoundingClientRect().top;
      /** Scrolls so the viewport top is 20 px into game n, then opens it. */
      const openGame = async (n: number) => {
        y = (n - 1) * 80 + 20;
        const link = document.querySelector<HTMLAnchorElement>(`a.game[data-key="NPWR${n}"]`)!;
        link.addEventListener("click", (e) => e.preventDefault());
        await act(async () => link.click());
      };
      /** Leaves for the game page; Back comes to the same history entry, at the top, with 300 px more
       *  above the list than before. */
      const leave = () => {
        cleanup();
        y = 0;
        above = 300;
      };

      it("restores the same rows and position after Show all", async ({ onTestFinished }) => {
        const slot = document.createElement("span");
        slot.id = SHOW_ALL_SLOT_ID;
        document.body.append(slot);
        onTestFinished(() => slot.remove());
        fetchMock.mockResolvedValueOnce(reply(games(51, 150), 200));
        mount();
        await act(async () => screen.getByRole("button", { name: "Show all" }).click());
        expect(rows()).toBe(200);
        const before = hrefs();

        await openGame(130);
        expect(JSON.parse(sessionStorage.getItem("games-list")!)).toMatchObject({
          key: "k",
          loaded: 200,
          anchorKey: "NPWR130",
          anchorOffset: -20,
        });

        leave();
        const back = await mountOutsideAct(
          <GameList snapshotKey="k" initial={{ items: games(1, 50), total: 200 }} query={query} />,
          "NPWR130",
        );
        try {
          expect(fetchMock).toHaveBeenCalledTimes(1); // Show all only: no request on the way back
          // From the first paint on: every row, game 130 back 20 px above the top, no Loading…, no footer.
          expect(back.paints[0]).toEqual({ rows: 200, top: -20, loading: false, footer: false });
          expect(back.paints.filter((p) => p.loading || p.footer)).toEqual([]);
          expect(hrefs()).toEqual(before);
          expect(scrollTo).toHaveBeenCalledWith(0, 300 + 129 * 80 + 20);
          expect(screen.queryByRole("button", { name: /Show all|Loading…/ })).toBeNull();
        } finally {
          back.unmount();
        }
      });

      it("restores after three loaded pages", async () => {
        // Three pages of games, with a page made only of games already shown in between.
        fetchMock
          .mockResolvedValueOnce(reply(games(1, 50), 300))
          .mockResolvedValueOnce(reply(games(51, 50), 300))
          .mockResolvedValueOnce(reply(games(101, 50), 300));
        mount("k", 300);
        await intersect(); // offset 50: only duplicates
        await intersect(); // offset 100
        await intersect(); // offset 150
        expect(rows()).toBe(150);
        const before = hrefs();

        await openGame(120);
        expect(JSON.parse(sessionStorage.getItem("games-list")!)).toMatchObject({
          loaded: 150,
          anchorKey: "NPWR120",
          anchorOffset: -20,
        });

        leave();
        await act(async () => {
          mount("k", 300);
        });
        expect(fetchMock).toHaveBeenCalledTimes(3); // no request on the way back
        expect(screen.queryByText("Loading…")).toBeNull();
        while (frames.size > 0) await runFrame();
        expect(hrefs()).toEqual(before);
        expect(scrollTo).toHaveBeenCalledWith(0, 300 + 119 * 80 + 20);
        expect(rowTop(120)).toBe(-20);

        // Scrolling on resumes after the 200 rows handed out, not after the 150 shown.
        expect(screen.getByText(FOOTER)).toBeInTheDocument();
        fetchMock.mockResolvedValueOnce(reply(games(151, 50), 300));
        await intersect();
        expect(fetchMock).toHaveBeenLastCalledWith("/api/games?offset=200");
        expect(rows()).toBe(200);
      });
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

    it("keeps loading past a page made only of duplicates", async () => {
      fetchMock.mockResolvedValueOnce(reply(games(1, 50), 120)); // only games already shown
      render(<GameList snapshotKey="k" initial={{ items: games(1, 50), total: 120 }} query={query} />);
      await intersect();
      expect(rows()).toBe(50);
      expect(screen.getByText(FOOTER)).toBeInTheDocument();
      expect(showAll()).toBeEnabled();

      // The rest starts after the 100 rows handed out so far, not after the 50 shown.
      fetchMock.mockResolvedValueOnce(reply(games(51, 20), 120));
      await act(async () => showAll().click());
      const url = new URL(String(fetchMock.mock.calls[1][0]), "http://x");
      expect(url.searchParams.get("offset")).toBe("100");
      expect(url.searchParams.get("all")).toBe("1");
      expect(rows()).toBe(70);
      // All 120 handed out: the list ends, though it shows 70.
      expect(screen.queryByText(FOOTER)).toBeNull();
      expect(screen.queryByRole("button", { name: /Show all|Loading…/ })).toBeNull();
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
