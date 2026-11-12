// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TrophyList } from "@/components/game/TrophyList";
import type { GroupData, TrophyRowData } from "@/src/games/detail";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const trophy = (id: number, o: Partial<TrophyRowData> = {}): TrophyRowData => ({
  id,
  groupId: "default",
  type: "bronze",
  name: `Trophy ${id}`,
  detail: `Detail ${id}`,
  iconSrc: "/i.png",
  earned: false,
  earnedDate: null,
  earnedTime: null,
  earnedAtMs: null,
  rate: 10,
  rateLabel: "10.00%",
  tier: "Rare",
  counter: null,
  unobtainable: false,
  ...o,
});

const group = (id: string, kicker: string, name: string): GroupData => ({
  id,
  kicker,
  name,
  iconSrc: "/g.png",
  iconIsCover: false,
  iconTileBg: null,
  earned: 1,
  total: 2,
  counts: { platinum: [0, 0], gold: [0, 0], silver: [0, 0], bronze: [1, 2] },
  progress: 50,
  rank: "B",
  status: "incomplete",
});

const one = [group("default", "Base game", "Game")];
const two = [...one, group("001", "DLC 1", "Expansion")];
const list = [
  trophy(0, { earned: true, earnedDate: "5 Nov 2026", earnedTime: "21:04:12", earnedAtMs: 1 }),
  trophy(1, { counter: "0/4" }),
  trophy(2, { groupId: "001", rate: null, rateLabel: null, tier: null }),
];

const band = {
  label: "7 unobtainable trophies",
  situation: ", 4 you don't have",
  note: [{ text: "Closed: " }, { text: "more info.", href: "https://x.dev" }],
};

const setup = (groups: GroupData[], trophies = list, unobtainable: typeof band | null = null) =>
  render(
    <TrophyList
      groups={groups}
      trophies={trophies}
      unobtainable={unobtainable}
      initialShow="all"
      initialSort="psn"
    />,
  );

describe("TrophyList", () => {
  it("shows the title and earned count", () => {
    setup(one);
    expect(screen.getByRole("heading", { name: "Trophies" })).toBeInTheDocument();
    expect(screen.getByText("1 of 3 earned")).toBeInTheDocument();
  });

  it("hides group headers with a single group", () => {
    const { container } = setup(one);
    expect(container.querySelectorAll(".group-head")).toHaveLength(0);
  });

  it("shows a header per group with several groups", () => {
    const { container } = setup(two);
    const heads = container.querySelectorAll(".group-head");
    expect(heads).toHaveLength(2);
    expect(heads[0]).toHaveTextContent("Base game");
    expect(heads[1]).toHaveTextContent("DLC 1");
  });

  it("filters to unearned and updates the address without a server round-trip", () => {
    const spy = vi.spyOn(window.history, "replaceState");
    const { container } = setup(one);
    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "unearned" } });
    expect(container.querySelectorAll(".trophy.earned")).toHaveLength(0);
    expect(container.querySelectorAll(".trophy")).toHaveLength(1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0][2])).toContain("show=unearned");
  });

  it("shows the counter of an unearned tiered trophy", () => {
    const { container } = setup(one);
    const rows = container.querySelectorAll(".trophy");
    expect(rows[1].querySelector(".when")).toHaveTextContent("0/4");
    expect(rows[1].querySelector(".when .count")).toBeNull();
    expect(rows[1].querySelector(".when .tcount")).toHaveTextContent("0/4");
  });

  it("shows date and time of an earned trophy", () => {
    const { container } = setup(one);
    const when = container.querySelector(".trophy.earned .when");
    expect(when).toHaveTextContent("5 Nov 2026");
    expect(when).toHaveTextContent("21:04:12");
  });

  it("shows rate and tier, or nothing", () => {
    const { container } = setup(two);
    const rates = container.querySelectorAll(".rate");
    expect(rates[0]).toHaveTextContent("10.00%");
    expect(rates[0]).toHaveTextContent("Rare");
    expect(rates[2]).toBeEmptyDOMElement();
  });

  it("shows the empty message when nothing matches", () => {
    setup(one, [trophy(1), trophy(2)]);
    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "earned" } });
    expect(screen.getByText("No trophy matches this filter.")).toBeInTheDocument();
  });

  it("drops a group with no visible row", () => {
    const { container } = setup(two);
    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "earned" } });
    expect(container.querySelectorAll(".group-head")).toHaveLength(1);
  });

  it("shows the band with its link", () => {
    const { container } = setup(one, list, band);
    const note = container.querySelector(".unob-note")!;
    expect(note).toHaveTextContent("7 unobtainable trophies");
    expect(note).toHaveTextContent(", 4 you don't have");
    expect(note).toHaveTextContent("Closed:");
    const link = screen.getByRole("link", { name: "more info." });
    expect(link).toHaveAttribute("href", "https://x.dev");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(container.querySelectorAll(".unob-note a")).toHaveLength(1);
  });

  it("shows no band for other games", () => {
    const { container } = setup(one, list, null);
    expect(container.querySelector(".unob-note")).toBeNull();
  });

  it("keeps the band when the filter hides every row", () => {
    const { container } = setup(one, [trophy(1), trophy(2)], band);
    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "earned" } });
    expect(screen.getByText("No trophy matches this filter.")).toBeInTheDocument();
    expect(container.querySelector(".unob-note")).not.toBeNull();
  });

  it("reddens an unearned unobtainable trophy", () => {
    const { container } = setup(one, [trophy(1, { unobtainable: true })]);
    const row = container.querySelector(".trophy")!;
    expect(row).toHaveClass("lost");
    expect(row).not.toHaveClass("earned");
    expect(row.querySelector(".unob")).toHaveTextContent("!");
    expect(row.querySelector(".unob .tip")).toHaveTextContent("No longer obtainable.");
    expect(row.querySelector(".unob .tip")).not.toHaveTextContent("already have");
    expect(row.querySelector(".unob")).toHaveAttribute("tabindex", "0");
  });

  it("keeps green for an earned one", () => {
    const { container } = setup(one, [trophy(1, { unobtainable: true, earned: true, earnedDate: "5 Nov 2026", earnedTime: "21:04:12", earnedAtMs: 1 })]);
    const row = container.querySelector(".trophy")!;
    expect(row).toHaveClass("earned");
    expect(row).not.toHaveClass("lost");
    expect(row.querySelector(".unob")).toHaveTextContent("!");
    expect(row.querySelector(".unob")).toHaveAttribute("aria-label", "No longer obtainable. You already have it.");
    expect(row.querySelector(".unob .tip")).toHaveTextContent("You already have it.");
  });

  it("marks nothing else", () => {
    const { container } = setup(one);
    expect(container.querySelector(".unob")).toBeNull();
    expect(container.querySelector(".trophy.lost")).toBeNull();
  });

  it("renders HTML from a note as text", () => {
    const { container } = setup(one, list, { ...band, note: [{ text: "<img src=x>" }] });
    expect(screen.getByText("<img src=x>")).toBeInTheDocument();
    expect(container.querySelector("img[src='x']")).toBeNull();
  });
});

describe("earned highlight CSS", () => {
  it("defines the earned highlight colours", () => {
    const css = readFileSync(path.resolve(import.meta.dirname, "../../app/globals.css"), "utf8");
    expect(css).toMatch(/:root\{[^}]*--earned:#3DBE6B/);
    expect(css).toMatch(/:root\{[^}]*--earned-text:#93E2AE/);
  });
});
