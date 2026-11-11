// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TileImage } from "@/components/TileImage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("TileImage", () => {
  it("renders a plain image with no style when it is not on a tile", () => {
    const { container } = render(<TileImage tile={false} bg="rgb(1, 2, 3)" className="cover" src="/a.png" alt="A cover" />);
    const img = container.querySelector("img")!;
    expect(img).toHaveAttribute("src", "/a.png");
    expect(img).toHaveAttribute("alt", "A cover");
    expect(img).toHaveClass("cover");
    expect(img.getAttribute("style")).toBeNull();
  });

  it("paints the tile colour on the very first render, without any load event", () => {
    const canvas = vi.spyOn(document, "createElement");
    const { container } = render(<TileImage tile bg="#000000" className="cover icon" src="/mho.png" alt="" />);
    const img = container.querySelector("img")!;
    expect(img.style.background).toBe("rgb(0, 0, 0)");
    expect(canvas).not.toHaveBeenCalledWith("canvas");
  });

  it("keeps the default tile (no style) when there is no stored colour", () => {
    const { container } = render(<TileImage tile bg={null} src="/logo.png" alt="" />);
    expect(container.querySelector("img")!.getAttribute("style")).toBeNull();
  });

  it("follows the colour when the source changes", () => {
    const { container, rerender } = render(<TileImage tile bg="#000000" src="/one.png" alt="" />);
    const img = container.querySelector("img")!;
    expect(img.style.background).toBe("rgb(0, 0, 0)");
    rerender(<TileImage tile bg={null} src="/two.png" alt="" />);
    expect(img.getAttribute("style") ?? "").not.toContain("background");
  });
});
