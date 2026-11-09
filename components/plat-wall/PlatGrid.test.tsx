// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlatGrid, type PlatTile } from "@/components/plat-wall/PlatGrid";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const tile = (t: Partial<PlatTile> = {}): PlatTile => ({
  key: "NPWR1_00",
  href: "/games/NPWR1_00",
  src: "/media/a.png",
  game: "Cyberpunk 2077",
  when: "17 Jul 2022",
  ratePct: "17.76%",
  ...t,
});

describe("PlatGrid", () => {
  it("shows only the art by default", () => {
    const { container } = render(<PlatGrid tiles={[tile()]} show={["art"]} />);
    expect(container.querySelector("img")).not.toBeNull();
    expect(container.querySelector(".pct")).toBeNull();
    expect(container.querySelector(".nm")).toBeNull();
  });

  it("adds the rarity and the name when asked", () => {
    const { container } = render(<PlatGrid tiles={[tile()]} show={["art", "rarity", "name"]} />);
    expect(container.querySelector(".pct")).toHaveTextContent("17.76%");
    expect(container.querySelector(".nm")).toHaveTextContent("Cyberpunk 2077");
  });

  it("draws a text card without the art", () => {
    const { container } = render(<PlatGrid tiles={[tile()]} show={["rarity", "name"]} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".plat.textonly")).not.toBeNull();
  });

  it("shows no rarity when it is unknown", () => {
    const { container } = render(<PlatGrid tiles={[tile({ ratePct: null })]} show={["art", "rarity"]} />);
    expect(container.querySelector(".pct")).toBeNull();
  });

  it("links to the game page", () => {
    render(<PlatGrid tiles={[tile()]} show={["art"]} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/games/NPWR1_00");
  });

  it("shows one tooltip on hover and on focus, then hides it", () => {
    render(<PlatGrid tiles={[tile()]} show={["art"]} />);
    const link = screen.getByRole("link");
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.mouseOver(link);
    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent("Cyberpunk 2077");
    expect(tip).toHaveTextContent("Earned 17 Jul 2022");
    expect(tip).toHaveTextContent("17.76% of players");
    fireEvent.mouseOut(link);
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.focus(link);
    expect(screen.getAllByRole("tooltip")).toHaveLength(1);
    fireEvent.blur(link);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("keeps the tooltip inside the window", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      left: 0, right: 92, top: 300, bottom: 392, width: 92, height: 92, x: 0, y: 300, toJSON: () => ({}),
    });
    render(<PlatGrid tiles={[tile()]} show={["art"]} />);
    fireEvent.mouseOver(screen.getByRole("link"));
    expect(screen.getByRole("tooltip").style.left).toBe("8px");
  });
});
