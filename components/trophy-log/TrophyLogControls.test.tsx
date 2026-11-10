// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TrophyLogControls } from "@/components/trophy-log/TrophyLogControls";
import { DEFAULT_LOG_QUERY, type LogQuery } from "@/src/trophy-log/query";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const query = (over: Partial<LogQuery> = {}): LogQuery => ({ ...DEFAULT_LOG_QUERY, ...over });

afterEach(() => {
  cleanup();
  replace.mockReset();
});

describe("TrophyLogControls", () => {
  it("changes the sort and resets the order", () => {
    render(<TrophyLogControls query={query({ sort: "date", order: "asc" })} />);
    fireEvent.change(screen.getByLabelText("Sort by"), { target: { value: "alphabetical" } });
    expect(replace).toHaveBeenCalledWith("/trophy-log?sort=alphabetical", { scroll: false });
  });

  it("reverses the order", () => {
    render(<TrophyLogControls query={query()} />);
    fireEvent.click(screen.getByRole("button", { name: "Newest first" }));
    expect(replace).toHaveBeenCalledWith("/trophy-log?order=asc", { scroll: false });
  });

  it("filters by rarity", () => {
    render(<TrophyLogControls query={query()} />);
    fireEvent.change(screen.getByLabelText("Filter by rarity"), { target: { value: "ultra-rare" } });
    expect(replace).toHaveBeenCalledWith("/trophy-log?rarity=ultra-rare", { scroll: false });
  });

  it("outlines what differs from the default", () => {
    render(<TrophyLogControls query={query({ platform: "PS5", sort: "alphabetical", order: "desc" })} />);
    expect(screen.getByLabelText("Filter by platform")).toHaveClass("on");
    expect(screen.getByRole("button", { name: "Z to A" })).toHaveClass("on");
    expect(screen.getByLabelText("Sort by")).toHaveClass("on");
    expect(screen.getByLabelText("Filter by rarity")).not.toHaveClass("on");
    expect(screen.getByLabelText("Filter by type")).not.toHaveClass("on");
  });

  it("shows Reset with its count and goes back to the defaults", () => {
    render(<TrophyLogControls query={query({ sort: "alphabetical", order: "desc", platform: "PS5" })} />);
    fireEvent.click(screen.getByRole("button", { name: "Reset (3)" }));
    expect(replace).toHaveBeenCalledWith("/trophy-log", { scroll: false });
  });

  it("has no Reset with the defaults", () => {
    render(<TrophyLogControls query={query()} />);
    expect(screen.queryByRole("button", { name: /Reset/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Newest first" })).not.toHaveClass("on");
  });
});
