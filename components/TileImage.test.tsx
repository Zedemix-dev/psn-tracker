// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TileImage } from "@/components/TileImage";

/** Gives the <img> a loaded natural size, as jsdom never loads images. */
function loaded(img: HTMLImageElement, width: number, height: number) {
  Object.defineProperty(img, "naturalWidth", { configurable: true, value: width });
  Object.defineProperty(img, "naturalHeight", { configurable: true, value: height });
  fireEvent.load(img);
}

/** A 2D context whose pixels are all `rgba`. */
function fakeCanvas(rgba: [number, number, number, number]) {
  return vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    const { width, height } = this;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) data.set(rgba, i);
    return { drawImage: () => {}, getImageData: () => ({ data }) } as unknown as CanvasRenderingContext2D;
  } as unknown as typeof HTMLCanvasElement.prototype.getContext);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("TileImage", () => {
  it("renders a plain image and never reads it when it is not on a tile", () => {
    const spy = fakeCanvas([0, 0, 0, 255]);
    const { container } = render(<TileImage tile={false} className="cover" src="/a.png" alt="A cover" />);
    const img = container.querySelector("img")!;
    loaded(img, 320, 176);
    expect(img).toHaveAttribute("src", "/a.png");
    expect(img).toHaveAttribute("alt", "A cover");
    expect(img).toHaveClass("cover");
    expect(img.getAttribute("style")).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("gives the tile the image's uniform edge colour once loaded", () => {
    fakeCanvas([0, 0, 0, 255]);
    const { container } = render(<TileImage tile className="cover icon" src="/mho.png" alt="" />);
    const img = container.querySelector("img")!;
    loaded(img, 320, 176);
    expect(img.style.background).toBe("rgb(0, 0, 0)");
  });

  it("keeps the default tile for a transparent edge, a square image or no canvas", () => {
    fakeCanvas([255, 255, 255, 0]);
    const { container } = render(<TileImage tile src="/logo.png" alt="" />);
    const img = container.querySelector("img")!;
    loaded(img, 320, 176);
    expect(img.getAttribute("style")).toBeNull();

    vi.restoreAllMocks();
    fakeCanvas([0, 0, 0, 255]);
    const square = render(<TileImage tile src="/sq.png" alt="" />).container.querySelector("img")!;
    loaded(square, 100, 100);
    expect(square.getAttribute("style")).toBeNull();

    vi.restoreAllMocks();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const none = render(<TileImage tile src="/x.png" alt="" />).container.querySelector("img")!;
    loaded(none, 320, 176);
    expect(none.getAttribute("style")).toBeNull();
  });

  it("drops the colour of the previous image when the source changes", () => {
    fakeCanvas([0, 0, 0, 255]);
    const { container, rerender } = render(<TileImage tile src="/one.png" alt="" />);
    const img = container.querySelector("img")!;
    loaded(img, 320, 176);
    expect(img.style.background).toBe("rgb(0, 0, 0)");
    rerender(<TileImage tile src="/two.png" alt="" />);
    expect(img.style.background).toBe("");
  });
});
