// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  ...o,
});

const group = (id: string, kicker: string, name: string): GroupData => ({
  id,
  kicker,
  name,
  iconSrc: "/g.png",
  iconIsCover: false,
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
  trophy(0, { earned: true, earnedDate: "5 Nov 2026", earnedTime: "21:04", earnedAtMs: 1 }),
  trophy(1, { counter: "0/4" }),
  trophy(2, { groupId: "001", rate: null, rateLabel: null, tier: null }),
];

const setup = (groups: GroupData[], trophies = list) =>
  render(<TrophyList groups={groups} trophies={trophies} initialShow="all" initialSort="psn" />);

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
    expect(when).toHaveTextContent("21:04");
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
});
