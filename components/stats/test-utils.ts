import { vi } from "vitest";

/** Stubs ResizeObserver and gives every element a measured width, as TrophyCarousel.test.tsx does. */
export function stubMeasure(width: number) {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(width);
}
