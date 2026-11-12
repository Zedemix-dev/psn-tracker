// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProgressiveList } from "@/components/ProgressiveList";
import { createPlaceStore } from "@/components/place-snapshot";

type Row = { key: string; n: number };
const row = (n: number): Row => ({ key: `R:${n}`, n });
const rowsFrom = (from: number, count: number) => Array.from({ length: count }, (_, i) => row(from + i));
const renderRow = (r: Row) => (
  <div className="log-row" data-key={r.key}>
    <a href={`/games/G${r.n}`}>Row {r.n}</a>
  </div>
);
const places = createPlaceStore("progressive-list-test", "progressiveListTest");

let trigger: () => void = () => {};
class FakeObserver {
  constructor(private cb: IntersectionObserverCallback) {}
  observe() {
    trigger = () => this.cb([{ isIntersecting: true } as IntersectionObserverEntry], this as never);
  }
  disconnect() {
    trigger = () => {};
  }
  unobserve() {}
}

const fetchMock = vi.fn<typeof fetch>();
const reply = (items: Row[], total: number) => new Response(JSON.stringify({ items, total }), { status: 200 });
const intersect = () => act(async () => trigger());
const rendered = () => [...document.querySelectorAll<HTMLElement>(".log-row")].map((el) => el.dataset.key);

const list = (items: Row[], total: number) => (
  <ProgressiveList
    initial={{ items, total }}
    apiPath="/api/rows"
    queryString=""
    snapshotKey="k"
    places={places}
    slotId="rows-show-all"
    renderRow={renderRow}
    empty="Nothing."
  />
);

beforeEach(() => {
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

describe("ProgressiveList", () => {
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

  it("keeps the trophy defaults", async () => {
    // Row key `key`, rows `.log-row[data-key]`, "trophies" in the texts, a container with no class.
    history.pushState(null, "");
    fetchMock.mockResolvedValueOnce(reply([row(2), ...rowsFrom(3, 2)], 6));
    render(list(rowsFrom(1, 2), 6));
    expect(document.querySelector(".log-row")!.parentElement!.getAttribute("class")).toBeNull();
    expect(screen.getByText("The next 50 trophies load as you scroll down")).toBeInTheDocument();

    await intersect();
    expect(rendered()).toEqual(["R:1", "R:2", "R:3", "R:4"]); // R:2 came twice, shown once

    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    await intersect();
    expect(screen.getByText(/Couldn't load more trophies\./)).toBeInTheDocument();

    // A tiny layout: row n sits at document y `above + (n - 1) * 100`; its rect follows the scroll.
    let y = 240;
    let above = 0;
    Object.defineProperty(window, "scrollY", { get: () => y, configurable: true });
    scrollTo.mockImplementation(((_x: number, to: number) => {
      y = to;
    }) as never);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const top = above + (Number(this.dataset.key?.split(":")[1] ?? 0) - 1) * 100 - y;
      return { top, bottom: top + 100 } as DOMRect;
    });

    // The place is the first `.log-row[data-key]` still showing at the viewport top.
    const link = document.querySelector<HTMLAnchorElement>('a[href^="/games/"]')!;
    link.addEventListener("click", (e) => e.preventDefault());
    await act(async () => link.click());
    expect(JSON.parse(sessionStorage.getItem("progressive-list-test")!)).toMatchObject({
      key: "k",
      loaded: 4,
      scrollY: 240,
      anchorKey: "R:3",
      anchorOffset: -40,
    });
    expect(sessionStorage.length).toBe(1); // the place only: no rows kept

    // Back, with 1000 px more above the list: the same rows again, and the saved row put back at
    // its offset (not the saved pixel).
    cleanup();
    y = 0;
    above = 1000;
    fetchMock.mockResolvedValueOnce(reply(rowsFrom(1, 4), 6));
    await act(async () => {
      render(list(rowsFrom(1, 2), 6));
    });
    expect(fetchMock).toHaveBeenLastCalledWith("/api/rows?offset=0&limit=4");
    expect(rendered()).toEqual(["R:1", "R:2", "R:3", "R:4"]);
    expect(scrollTo).toHaveBeenCalledWith(0, 1240);
    expect(document.querySelector<HTMLElement>('.log-row[data-key="R:3"]')!.getBoundingClientRect().top).toBe(-40);
  });
});
