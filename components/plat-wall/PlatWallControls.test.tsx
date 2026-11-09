// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlatWallControls } from "@/components/plat-wall/PlatWallControls";
import type { PlatQuery } from "@/src/plat-wall/query";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

const query = (over: Partial<PlatQuery> = {}): PlatQuery => ({
  year: null,
  platform: "all",
  sort: "newest",
  show: ["art"],
  ...over,
});
const years = [2026, 2025];
const open = () => fireEvent.click(screen.getByRole("button", { name: "Display" }));
const menu = () => document.querySelector(".dd-menu");

afterEach(() => {
  cleanup();
  replace.mockReset();
});

describe("PlatWallControls", () => {
  it("ticks Rarity", () => {
    render(<PlatWallControls query={query()} years={years} canExport fileName="x.png" />);
    open();
    fireEvent.click(screen.getByLabelText("Rarity"));
    expect(replace).toHaveBeenCalledWith("/plat-wall?show=art%2Crarity", { scroll: false });
  });

  it("accumulates ticks made before the server answers", () => {
    render(<PlatWallControls query={query()} years={years} canExport fileName="x.png" />);
    open();
    fireEvent.click(screen.getByLabelText("Rarity"));
    fireEvent.click(screen.getByLabelText("Name"));
    expect(replace).toHaveBeenLastCalledWith("/plat-wall?show=art%2Crarity%2Cname", { scroll: false });
  });

  it("keeps the last ticked option", () => {
    render(<PlatWallControls query={query()} years={years} canExport fileName="x.png" />);
    open();
    expect(screen.getByLabelText("Art")).toBeDisabled();
    expect(screen.getByLabelText("Rarity")).not.toBeDisabled();
  });

  it("filters by year", () => {
    render(<PlatWallControls query={query()} years={years} canExport fileName="x.png" />);
    fireEvent.change(screen.getByLabelText("Filter by year"), { target: { value: "2025" } });
    expect(replace).toHaveBeenCalledWith("/plat-wall?year=2025", { scroll: false });
  });

  it("lists All years first, then the years given", () => {
    render(<PlatWallControls query={query()} years={years} canExport fileName="x.png" />);
    const select = screen.getByLabelText("Filter by year") as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual(["All years", "2026", "2025"]);
  });

  it("goes back to the bare URL with the defaults", () => {
    render(<PlatWallControls query={query({ year: 2025 })} years={years} canExport fileName="x.png" />);
    fireEvent.change(screen.getByLabelText("Filter by year"), { target: { value: "all" } });
    expect(replace).toHaveBeenCalledWith("/plat-wall", { scroll: false });
  });

  it("sorts and filters by platform", () => {
    render(<PlatWallControls query={query()} years={years} canExport fileName="x.png" />);
    fireEvent.change(screen.getByLabelText("Sort by"), { target: { value: "rarity" } });
    expect(replace).toHaveBeenCalledWith("/plat-wall?sort=rarity", { scroll: false });
    fireEvent.change(screen.getByLabelText("Filter by platform"), { target: { value: "PS5" } });
    expect(replace).toHaveBeenCalledWith("/plat-wall?platform=PS5", { scroll: false });
  });

  it("marks active filters", () => {
    const { rerender } = render(<PlatWallControls query={query()} years={years} canExport fileName="x.png" />);
    expect(screen.getByLabelText("Filter by year")).not.toHaveClass("on");
    expect(screen.getByLabelText("Filter by platform")).not.toHaveClass("on");
    rerender(<PlatWallControls query={query({ year: 2025, platform: "PS5" })} years={years} canExport fileName="x.png" />);
    expect(screen.getByLabelText("Filter by year")).toHaveClass("on");
    expect(screen.getByLabelText("Filter by platform")).toHaveClass("on");
  });

  it("closes the Display menu on Escape and on an outside click", () => {
    render(<PlatWallControls query={query()} years={years} canExport fileName="x.png" />);
    expect(menu()).toBeNull();
    open();
    expect(menu()).not.toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(menu()).toBeNull();
    open();
    fireEvent.click(screen.getByLabelText("Rarity"));
    expect(menu()).not.toBeNull();
    fireEvent.mouseDown(document.body);
    expect(menu()).toBeNull();
  });
});

describe("PlatWallControls export", () => {
  const props = { years, fileName: "x.png" };
  it("disables Export PNG when nothing matches", () => {
    render(<PlatWallControls query={query()} canExport={false} {...props} />);
    expect(screen.getByRole("button", { name: "Export PNG" })).toBeDisabled();
  });

  it("opens the preview from Export PNG", () => {
    render(<PlatWallControls query={query()} canExport {...props} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Export PNG" }));
    expect(screen.getByRole("dialog", { name: "PNG preview" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
