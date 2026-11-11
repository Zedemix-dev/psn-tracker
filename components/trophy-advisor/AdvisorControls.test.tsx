// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdvisorControls } from "@/components/trophy-advisor/AdvisorControls";
import { DEFAULT_ADVISOR_QUERY, type AdvisorQuery } from "@/src/trophy-advisor/query";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const query = (over: Partial<AdvisorQuery> = {}): AdvisorQuery => ({ ...DEFAULT_ADVISOR_QUERY, ...over });

afterEach(() => {
  cleanup();
  replace.mockReset();
});

describe("AdvisorControls", () => {
  it("offers only Rarity and Alphabetical", () => {
    render(<AdvisorControls query={query()} />);
    const options = [...screen.getByLabelText("Sort by").querySelectorAll("option")].map((o) => o.textContent);
    expect(options).toEqual(["Rarity", "Alphabetical"]);
  });

  it("changes the sort and resets the order", () => {
    render(<AdvisorControls query={query({ order: "asc" })} />);
    fireEvent.change(screen.getByLabelText("Sort by"), { target: { value: "alphabetical" } });
    expect(replace).toHaveBeenCalledWith("/trophy-advisor?sort=alphabetical", { scroll: false });
  });

  it("reverses the order", () => {
    render(<AdvisorControls query={query()} />);
    fireEvent.click(screen.getByRole("button", { name: "Most common first" }));
    expect(replace).toHaveBeenCalledWith("/trophy-advisor?order=asc", { scroll: false });
  });

  it("filters by rarity", () => {
    render(<AdvisorControls query={query()} />);
    fireEvent.change(screen.getByLabelText("Filter by rarity"), { target: { value: "ultra-rare" } });
    expect(replace).toHaveBeenCalledWith("/trophy-advisor?rarity=ultra-rare", { scroll: false });
  });

  it("outlines what differs from the default", () => {
    render(<AdvisorControls query={query({ platform: "PS5", sort: "alphabetical", order: "desc" })} />);
    expect(screen.getByLabelText("Filter by platform")).toHaveClass("on");
    expect(screen.getByRole("button", { name: "Z to A" })).toHaveClass("on");
    expect(screen.getByLabelText("Sort by")).toHaveClass("on");
    expect(screen.getByLabelText("Filter by rarity")).not.toHaveClass("on");
  });

  it("reads Most common first by default, with no accent contour and no Reset", () => {
    render(<AdvisorControls query={query()} />);
    expect(screen.getByRole("button", { name: "Most common first" })).not.toHaveClass("on");
    expect(screen.getByLabelText("Sort by")).not.toHaveClass("on");
    expect(screen.queryByRole("button", { name: /Reset/ })).toBeNull();
  });

  it("resets to the defaults without touching the settings", () => {
    render(<AdvisorControls query={query({ sort: "alphabetical", order: "desc", platform: "PS5" })} />);
    fireEvent.click(screen.getByRole("button", { name: "Reset (3)" }));
    expect(replace).toHaveBeenCalledWith("/trophy-advisor", { scroll: false });
  });
});
