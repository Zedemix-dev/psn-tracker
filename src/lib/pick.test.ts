import { describe, expect, it } from "vitest";
import { pick } from "./pick";

describe("pick", () => {
  it("returns the value when allowed, else the fallback", () => {
    const allowed = ["art", "trophies"] as const;
    expect(pick(allowed, "trophies", "art")).toBe("trophies");
    expect(pick(allowed, "other", "art")).toBe("art");
    expect(pick(allowed, null, "art")).toBe("art");
  });
});
