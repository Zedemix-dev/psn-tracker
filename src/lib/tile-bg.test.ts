import { describe, expect, it } from "vitest";
import { edgeBackground } from "@/src/lib/tile-bg";

type Px = [r: number, g: number, b: number, a: number];

/** RGBA buffer of width x height, each pixel from `at(x, y)`. */
function image(width: number, height: number, at: (x: number, y: number) => Px): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) data.set(at(x, y), (y * width + x) * 4);
  return data;
}

const BLACK: Px = [0, 0, 0, 255];
const RED: Px = [200, 10, 10, 255];
const BLUE: Px = [10, 20, 200, 255];
const LOGO: Px = [255, 200, 0, 255];
/** Landscape icon: uniform edges `top`/`bottom`, something else inside. */
const landscape = (top: Px, bottom: Px, w = 32, h = 18) =>
  image(w, h, (_x, y) => (y === 0 ? top : y === h - 1 ? bottom : LOGO));

describe("edgeBackground", () => {
  it("returns the colour of uniform opaque top and bottom rows", () => {
    expect(edgeBackground(landscape(BLACK, BLACK), 32, 18)).toBe("#000000");
  });

  it("tolerates small noise (lossy WebP) and returns the rounded mean", () => {
    const data = image(32, 18, (x, y) =>
      y === 0 || y === 17 ? [x % 2 ? 4 : 0, 0, x % 2 ? 4 : 0, 255] : LOGO,
    );
    expect(edgeBackground(data, 32, 18)).toBe("#020002");
  });

  it("returns null when an edge is transparent (logo on a transparent background)", () => {
    expect(edgeBackground(landscape([255, 255, 255, 0], [255, 255, 255, 0]), 32, 18)).toBeNull();
    expect(edgeBackground(landscape(BLACK, [0, 0, 0, 200]), 32, 18)).toBeNull();
  });

  it("returns null when an edge is not a single colour", () => {
    const data = image(32, 18, (x, y) => (y === 0 ? (x < 16 ? [0, 0, 0, 255] : [80, 80, 80, 255]) : y === 17 ? BLACK : LOGO));
    expect(edgeBackground(data, 32, 18)).toBeNull();
  });

  it("splits the tile when top and bottom differ", () => {
    expect(edgeBackground(landscape(RED, BLUE), 32, 18)).toBe("linear-gradient(#c80a0a 50%, #0a14c8 50%)");
  });

  it("reads the left and right columns of a portrait image", () => {
    const data = image(18, 32, (x) => (x === 0 ? RED : x === 17 ? BLUE : LOGO));
    expect(edgeBackground(data, 18, 32)).toBe("linear-gradient(to right, #c80a0a 50%, #0a14c8 50%)");
  });

  it("returns null for a square or empty image (no bands to fill)", () => {
    expect(edgeBackground(image(8, 8, () => BLACK), 8, 8)).toBeNull();
    expect(edgeBackground(new Uint8ClampedArray(0), 0, 0)).toBeNull();
  });
});
