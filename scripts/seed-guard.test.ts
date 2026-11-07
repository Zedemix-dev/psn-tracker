import { describe, expect, it } from "vitest";
import { isSafeSeedTarget } from "./seed-guard";

describe("isSafeSeedTarget", () => {
  it("accepts pglite and local hosts", () => {
    expect(isSafeSeedTarget("pglite:./.data/dev", [])).toBe(true);
    expect(isSafeSeedTarget("pglite:memory", [])).toBe(true);
    expect(isSafeSeedTarget("postgres://u:p@localhost:5432/db", [])).toBe(true);
    expect(isSafeSeedTarget("postgres://u:p@127.0.0.1/db", [])).toBe(true);
  });

  it("refuses remote or unparsable targets", () => {
    expect(isSafeSeedTarget("postgres://u:p@db.example.com:5432/db", [])).toBe(false);
    expect(isSafeSeedTarget("postgres://u:p@localhost.evil.com/db", [])).toBe(false);
    expect(isSafeSeedTarget("not a url", [])).toBe(false);
  });

  it("allows anything with --force", () => {
    expect(isSafeSeedTarget("postgres://u:p@db.example.com/db", ["--force"])).toBe(true);
  });
});
