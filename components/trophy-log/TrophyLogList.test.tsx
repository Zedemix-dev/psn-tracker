// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveLogSnapshot } from "@/components/trophy-log/log-snapshot";
import { TrophyLogList } from "@/components/trophy-log/TrophyLogList";
import { DEFAULT_LOG_QUERY, LOG_SHOW_ALL_SLOT_ID, type LogQuery } from "@/src/trophy-log/query";
import type { LogRow } from "@/src/trophy-log/load";

const trophy = (n: number): LogRow => ({
  key: `NPWR1_00:${n}`,
  n,
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
  date: "9 Nov 2026",
  time: "15:46:30",
  ratePct: "4.60%",
  tier: "Ultra rare",
  unobtainable: false,
});
const trophies = (from: number, count: number) => Array.from({ length: count }, (_, i) => trophy(from + i));

const query: LogQuery = DEFAULT_LOG_QUERY;
const rarity: LogQuery = { ...DEFAULT_LOG_QUERY, sort: "rarity", order: "asc" };

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
const reply = (items: LogRow[], total: number) => new Response(JSON.stringify({ items, total }), { status: 200 });
const intersect = () => act(async () => trigger());
const rows = () => document.querySelectorAll(".log-row").length;
const FOOTER = "The next 50 trophies load as you scroll down";
const EMPTY = "No trophies earned yet.";

beforeEach(() => {
  observed = 0;
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fetchMock.mockReset();
  sessionStorage.clear();
});

const list = (items: LogRow[], total: number, q = query, snapshotKey = "k") => (
  <TrophyLogList snapshotKey={snapshotKey} initial={{ items, total }} query={q} empty={EMPTY} />
);

describe("TrophyLogList", () => {
  it("loads the next 50 when the bottom shows", async () => {
    fetchMock.mockResolvedValueOnce(reply(trophies(51, 20), 70));
    render(list(trophies(1, 50), 70, rarity));
    expect(rows()).toBe(50);
    expect(screen.getByText(FOOTER)).toBeInTheDocument();
    expect(observerOptions?.rootMargin).toBe("100000px 0px 600px 0px");

    await intersect();
    expect(fetchMock).toHaveBeenCalledWith("/api/trophy-log?sort=rarity&offset=50");
    expect(rows()).toBe(70);
    expect(screen.queryByText(FOOTER)).toBeNull();
  });

  it("does not observe anything when the first page holds every trophy", () => {
    render(list(trophies(1, 3), 3));
    expect(observed).toBe(0);
    expect(screen.queryByText(FOOTER)).toBeNull();
  });

  it("offers Retry after a failure", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    render(list(trophies(1, 50), 60));
    await intersect();
    expect(screen.getByText(/Couldn't load more trophies\./)).toBeInTheDocument();
    expect(rows()).toBe(50);

    fetchMock.mockResolvedValueOnce(reply(trophies(51, 10), 60));
    await act(async () => screen.getByRole("button", { name: "Retry" }).click());
    expect(rows()).toBe(60);
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("never shows a row twice", async () => {
    fetchMock.mockResolvedValueOnce(reply([trophy(50), ...trophies(51, 2)], 52));
    render(list(trophies(1, 50), 52));
    await intersect();
    expect(rows()).toBe(52);
  });

  it("shows the empty text and no Show all", () => {
    const slot = document.createElement("span");
    slot.id = LOG_SHOW_ALL_SLOT_ID;
    document.body.append(slot);
    render(list([], 0));
    expect(screen.getByText(EMPTY)).toBeInTheDocument();
    expect(screen.queryByText(FOOTER)).toBeNull();
    expect(screen.queryByRole("button", { name: "Show all" })).toBeNull();
    slot.remove();
  });

  describe("Show all", () => {
    let slot: HTMLSpanElement;
    beforeEach(() => {
      slot = document.createElement("span");
      slot.id = LOG_SHOW_ALL_SLOT_ID;
      document.body.append(slot);
    });
    afterEach(() => slot.remove());

    it("loads the rest with Show all, then disappears", async () => {
      let resolve!: (r: Response) => void;
      fetchMock.mockReturnValueOnce(new Promise<Response>((r) => (resolve = r)));
      render(list(trophies(1, 50), 60));
      const button = screen.getByRole("button", { name: "Show all" });
      expect(slot).toContainElement(button);
      await act(async () => button.click());
      expect(fetchMock).toHaveBeenCalledWith("/api/trophy-log?offset=50&all=1");
      expect(screen.getByRole("button", { name: "Loading…" })).toBeDisabled();

      await act(async () => resolve(reply(trophies(51, 10), 60)));
      expect(rows()).toBe(60);
      expect(screen.queryByRole("button", { name: /Show all|Loading…/ })).toBeNull();
    });

    it("makes one request when scrolling races with Show all", async () => {
      fetchMock.mockReturnValueOnce(new Promise<Response>(() => {}));
      render(list(trophies(1, 50), 60));
      await act(async () => screen.getByRole("button", { name: "Show all" }).click());
      await intersect();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
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
    });

    it("saves the place, without rows, when a game link is clicked", async () => {
      history.pushState(null, "");
      render(list(trophies(1, 50), 200));
      Object.defineProperty(window, "scrollY", { value: 900, configurable: true });
      const link = document.querySelector<HTMLAnchorElement>('a[href^="/games/"]')!;
      link.addEventListener("click", (e) => e.preventDefault());
      await act(async () => link.click());
      const saved = JSON.parse(sessionStorage.getItem("trophy-log-list")!);
      expect(saved).toMatchObject({ key: "k", loaded: 50, scrollY: 900 });
      expect(saved.items).toBeUndefined();
      expect(sessionStorage.getItem("trophy-log-list")).not.toContain("Trophy 1");
    });

    it("does not save on modified clicks", async () => {
      render(list(trophies(1, 50), 200));
      const link = document.querySelector<HTMLAnchorElement>('a[href^="/games/"]')!;
      link.addEventListener("click", (e) => e.preventDefault());
      await act(async () => {
        link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true }));
        link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 1 }));
      });
      expect(sessionStorage.getItem("trophy-log-list")).toBeNull();
    });

    describe("with a saved place", () => {
      beforeEach(() => saveLogSnapshot({ key: "k", loaded: 120, scrollY: 3400 }));

      it("puts the rows and the scroll back after Back", async () => {
        fetchMock.mockResolvedValueOnce(reply(trophies(1, 120), 200));
        await act(async () => {
          render(list(trophies(1, 50), 200));
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith("/api/trophy-log?offset=0&limit=120");
        expect(rows()).toBe(120);
        expect(scrollTo).toHaveBeenCalledWith(0, 3400);
      });

      it("restores with the filters of the list", async () => {
        fetchMock.mockResolvedValueOnce(reply(trophies(1, 120), 200));
        await act(async () => {
          render(list(trophies(1, 50), 200, rarity));
        });
        expect(fetchMock).toHaveBeenCalledWith("/api/trophy-log?sort=rarity&offset=0&limit=120");
      });

      it("starts from the top on a fresh visit", async () => {
        history.pushState(null, "");
        await act(async () => {
          render(list(trophies(1, 50), 200));
        });
        expect(fetchMock).not.toHaveBeenCalled();
        expect(rows()).toBe(50);
        expect(scrollTo).not.toHaveBeenCalled();
      });

      it("ignores a place saved for other filters or before a sync", async () => {
        await act(async () => {
          render(list(trophies(1, 50), 200, query, "other"));
        });
        expect(fetchMock).not.toHaveBeenCalled();
        expect(rows()).toBe(50);
        expect(scrollTo).not.toHaveBeenCalled();
      });

      it("keeps the first page when the restore fails", async () => {
        fetchMock.mockRejectedValueOnce(new Error("offline"));
        await act(async () => {
          render(list(trophies(1, 50), 200));
        });
        expect(rows()).toBe(50);
        expect(scrollTo).not.toHaveBeenCalled();
        expect(screen.getByText(FOOTER)).toBeInTheDocument();
      });

      it("keeps the first page when the restore answers an error", async () => {
        fetchMock.mockResolvedValueOnce(new Response("{}", { status: 500 }));
        await act(async () => {
          render(list(trophies(1, 50), 200));
        });
        expect(rows()).toBe(50);
        expect(scrollTo).not.toHaveBeenCalled();
      });

      it("does not crash when sessionStorage throws", async () => {
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
          throw new Error("denied");
        });
        await act(async () => {
          render(list(trophies(1, 50), 200));
        });
        expect(rows()).toBe(50);
      });
    });
  });
});
