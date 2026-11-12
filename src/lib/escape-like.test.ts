import { describe, expect, it } from "vitest";
import { escapeLike } from "./escape-like";

describe("escapeLike", () => {
  it("escapes backslash, percent and underscore", () => {
    expect(escapeLike("a\\b%c_d")).toBe("a\\\\b\\%c\\_d");
  });
  it("leaves other characters alone", () => {
    expect(escapeLike("Uncharted 4")).toBe("Uncharted 4");
  });
});
