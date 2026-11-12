// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const renders = vi.hoisted(() => ({ byKey: new Map<string, number>() }));
vi.mock("@/components/trophy-log/TrophyLogRow", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/trophy-log/TrophyLogRow")>();
  return {
    ...actual,
    TrophyLogRow: (props: Parameters<typeof actual.TrophyLogRow>[0]) => {
      renders.byKey.set(props.row.key, (renders.byKey.get(props.row.key) ?? 0) + 1);
      return actual.TrophyLogRow(props);
    },
  };
});
import { saveLogSnapshot } from "@/components/trophy-log/log-snapshot";
import { LOG_RENDER_CHUNK, TrophyLogList } from "@/components/trophy-log/TrophyLogList";
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
  gameTileBg: null,
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

// A controllable requestAnimationFrame: callbacks wait until a test runs them.
let frames = new Map<number, FrameRequestCallback>();
let nextFrame = 1;
const cancelled: number[] = [];
const fakeFrames = () => {
  frames = new Map();
  nextFrame = 1;
  cancelled.length = 0;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    frames.set(nextFrame, cb);
    return nextFrame++;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    cancelled.push(id);
    frames.delete(id);
  });
};
const runFrame = () =>
  act(async () => {
    const [id, cb] = [...frames][0];
    frames.delete(id);
    cb(0);
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

    describe("during a Back restore", () => {
      const pendingRestore = () => {
        let resolve!: (r: Response) => void;
        fetchMock.mockReturnValueOnce(new Promise<Response>((r) => (resolve = r)));
        return (r: Response) => resolve(r);
      };
      beforeEach(() => {
        fakeFrames();
        saveLogSnapshot({ key: "k", loaded: 900, scrollY: 3400 });
      });

      it("reads Loading… and is disabled while rows come back, then Show all if rows remain", async () => {
        const resolve = pendingRestore();
        await act(async () => {
          render(list(trophies(1, 50), 1000));
        });
        expect(screen.getByRole("button", { name: "Loading…" })).toBeDisabled();
        await act(async () => resolve(reply(trophies(1, 900), 1000)));
        expect(screen.getByRole("button", { name: "Loading…" })).toBeDisabled();
        while (frames.size > 0) await runFrame();
        expect(rows()).toBe(900);
        expect(screen.getByRole("button", { name: "Show all" })).toBeEnabled();
      });

      it("is gone after the last chunk when everything is back", async () => {
        const resolve = pendingRestore();
        await act(async () => {
          render(list(trophies(1, 50), 900));
        });
        expect(screen.getByRole("button", { name: "Loading…" })).toBeDisabled();
        await act(async () => resolve(reply(trophies(1, 900), 900)));
        while (frames.size > 0) await runFrame();
        expect(screen.queryByRole("button", { name: /Show all|Loading…/ })).toBeNull();
      });

      it("reads Show all again when the restore fails", async () => {
        fetchMock.mockRejectedValueOnce(new Error("offline"));
        await act(async () => {
          render(list(trophies(1, 50), 1000));
        });
        expect(screen.getByRole("button", { name: "Show all" })).toBeEnabled();
      });
    });

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

    it("adds a Show all result chunk by chunk", async () => {
      fakeFrames();
      fetchMock.mockResolvedValueOnce(reply(trophies(51, 650), 700));
      render(list(trophies(1, 50), 700));
      await act(async () => screen.getByRole("button", { name: "Show all" }).click());
      expect(rows()).toBe(50 + LOG_RENDER_CHUNK);
      expect(screen.getByRole("button", { name: "Loading…" })).toBeDisabled();

      await runFrame();
      expect(rows()).toBe(50 + 2 * LOG_RENDER_CHUNK);
      expect(screen.getByRole("button", { name: "Loading…" })).toBeDisabled();
      await runFrame();
      expect(rows()).toBe(700);
      expect(screen.queryByRole("button", { name: /Show all|Loading…/ })).toBeNull();
      expect(frames.size).toBe(0);
    });

    it("does not render the rows already shown again when the next chunk lands", async () => {
      fakeFrames();
      renders.byKey.clear();
      fetchMock.mockResolvedValueOnce(reply(trophies(51, 650), 700));
      render(list(trophies(1, 50), 700));
      await act(async () => screen.getByRole("button", { name: "Show all" }).click());
      await runFrame();
      expect(rows()).toBe(50 + 2 * LOG_RENDER_CHUNK);
      expect(renders.byKey.get("NPWR1_00:1")).toBe(1);
      expect(renders.byKey.get("NPWR1_00:60")).toBe(1);
      expect(renders.byKey.get("NPWR1_00:400")).toBe(1);
    });

    it("asks for nothing more while chunks are pending", async () => {
      fakeFrames();
      fetchMock.mockResolvedValueOnce(reply(trophies(51, 650), 700));
      render(list(trophies(1, 50), 700));
      await act(async () => screen.getByRole("button", { name: "Show all" }).click());
      await intersect();
      await act(async () => screen.getByRole("button", { name: "Loading…" }).click());
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await runFrame();
      await intersect();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("stops adding rows after unmount", async () => {
      fakeFrames();
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      fetchMock.mockResolvedValueOnce(reply(trophies(51, 650), 700));
      const { unmount } = render(list(trophies(1, 50), 700));
      await act(async () => screen.getByRole("button", { name: "Show all" }).click());
      const pending = [...frames.keys()];
      expect(pending).toHaveLength(1);
      unmount();
      expect(cancelled).toContain(pending[0]);
      expect(frames.size).toBe(0);
      expect(error).not.toHaveBeenCalled();
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

    it("saves the place when a game link outside the list is clicked", async ({ onTestFinished }) => {
      fetchMock.mockResolvedValueOnce(reply(trophies(51, 20), 200));
      const { unmount } = render(list(trophies(1, 50), 200));
      const outside = document.createElement("a");
      outside.setAttribute("href", "/games/X");
      outside.addEventListener("click", (e) => e.preventDefault());
      document.body.append(outside);
      onTestFinished(() => outside.remove());
      await intersect();
      expect(rows()).toBe(70);

      await act(async () => {
        outside.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true }));
        outside.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 1 }));
      });
      expect(sessionStorage.getItem("trophy-log-list")).toBeNull();

      await act(async () => outside.click());
      expect(JSON.parse(sessionStorage.getItem("trophy-log-list")!)).toMatchObject({ key: "k", loaded: 70 });

      sessionStorage.clear();
      unmount();
      outside.click();
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

      it("scrolls back as soon as the page is tall enough", async () => {
        fakeFrames();
        saveLogSnapshot({ key: "k", loaded: 900, scrollY: 3400 });
        let height = 0;
        vi.spyOn(document.documentElement, "scrollHeight", "get").mockImplementation(() => height);
        vi.stubGlobal("innerHeight", 800);
        fetchMock.mockResolvedValueOnce(reply(trophies(1, 900), 1000));
        await act(async () => {
          render(list(trophies(1, 50), 1000));
        });
        expect(rows()).toBe(LOG_RENDER_CHUNK);
        expect(scrollTo).not.toHaveBeenCalled();

        height = 4300; // 4300 - 800 = 3500 >= 3400
        await runFrame();
        expect(rows()).toBe(2 * LOG_RENDER_CHUNK);
        expect(scrollTo).toHaveBeenCalledTimes(1);
        expect(scrollTo).toHaveBeenCalledWith(0, 3400);

        // Frames now: the next chunk, then the follow-up scroll. Run them all.
        while (frames.size > 0) await runFrame();
        expect(rows()).toBe(900);
        expect(scrollTo).toHaveBeenCalledTimes(2); // once now, once on the next frame, no more
      });

      describe("keeping the saved row in place", () => {
        // A tiny layout: the anchor row sits at document position docY(); its rect follows scrollY.
        let y = 0;
        let docY: () => number = () => 1000;
        const ANCHOR = "NPWR1_00:450";
        const restore = async () => {
          fakeFrames();
          y = 0;
          scrollTo.mockImplementation(((_x: number, to: number) => {
            y = to;
          }) as never);
          Object.defineProperty(window, "scrollY", { get: () => y, configurable: true });
          saveLogSnapshot({ key: "k", loaded: 900, scrollY: 3400, anchorKey: ANCHOR, anchorOffset: -20 });
          vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
            return { top: this.dataset.key === ANCHOR ? docY() - y : 0 } as DOMRect;
          });
          fetchMock.mockResolvedValueOnce(reply(trophies(1, 900), 1000));
          let view!: ReturnType<typeof render>;
          await act(async () => {
            view = render(list(trophies(1, 50), 1000));
          });
          expect(rows()).toBe(LOG_RENDER_CHUNK); // row 450 is not in yet
          expect(scrollTo).not.toHaveBeenCalled();
          await runFrame(); // 600 rows: row 450 is there
          expect(scrollTo).toHaveBeenCalledTimes(1);
          expect(scrollTo).toHaveBeenCalledWith(0, 1020); // the row, not the saved pixel 3400
          return view;
        };
        const runAll = async () => {
          while (frames.size > 0) await runFrame();
        };
        beforeEach(() => {
          docY = () => 1000;
        });

        it("scrolls back to the saved row, not the saved pixel, then leaves it alone once settled", async () => {
          await restore();
          await runAll();
          expect(rows()).toBe(900);
          expect(scrollTo).toHaveBeenCalledTimes(1);
        });

        it("re-places the row while rows above it grow, and stops after 3 stable frames", async () => {
          await restore();
          docY = () => 1000 + 2716; // rows above rendered with their real height
          await runFrame();
          await runAll();
          expect(scrollTo).toHaveBeenCalledTimes(2);
          expect(scrollTo).toHaveBeenLastCalledWith(0, 3736);
          expect(frames.size).toBe(0);
        });

        it("gives up after 30 frames when the row never settles", async () => {
          await restore();
          let n = 0;
          docY = () => 1000 + ++n * 50;
          await runAll();
          expect(scrollTo).toHaveBeenCalledTimes(1 + 30);
          expect(frames.size).toBe(0);
        });

        it("stops on user input", async () => {
          await restore();
          docY = () => 5000;
          act(() => {
            window.dispatchEvent(new Event("wheel"));
          });
          await runAll();
          expect(scrollTo).toHaveBeenCalledTimes(1);
        });

        it("schedules nothing after unmount", async () => {
          const { unmount } = await restore();
          unmount();
          expect(frames.size).toBe(0);
          docY = () => 5000;
          window.dispatchEvent(new Event("wheel"));
          expect(scrollTo).toHaveBeenCalledTimes(1);
        });
      });

      it("falls back to the saved pixel when the saved row never comes", async () => {
        fakeFrames();
        saveLogSnapshot({ key: "k", loaded: 900, scrollY: 3400, anchorKey: "NPWR1_00:5000", anchorOffset: 0 });
        fetchMock.mockResolvedValueOnce(reply(trophies(1, 900), 1000));
        await act(async () => {
          render(list(trophies(1, 50), 1000));
        });
        await runFrame();
        expect(scrollTo).not.toHaveBeenCalled();
        await runFrame();
        expect(rows()).toBe(900);
        expect(scrollTo).toHaveBeenCalledWith(0, 3400);
      });

      it("saves the row at the top of the viewport with its offset", async () => {
        history.pushState(null, "");
        render(list(trophies(1, 50), 200));
        vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
          const n = Number(this.dataset.key?.split(":")[1] ?? 0);
          return { top: (n - 3) * 100 - 40, bottom: (n - 3) * 100 + 60 } as DOMRect;
        });
        const link = document.querySelector<HTMLAnchorElement>('a[href^="/games/"]')!;
        link.addEventListener("click", (e) => e.preventDefault());
        await act(async () => link.click());
        expect(JSON.parse(sessionStorage.getItem("trophy-log-list")!)).toMatchObject({
          anchorKey: "NPWR1_00:3",
          anchorOffset: -40,
        });
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
