import { describe, expect, it } from "vitest";
import { LIST_INVALID, isListUrl, parseList } from "./list";

const entry = { title: "Dauntless", platforms: ["PS4"], submitter: "x", note: "Closed.", trophies: [0], timestamp: 5 };

describe("parseList", () => {
  it("reads a valid list", () =>
    expect(parseList({ version: 2, list: { "9120": entry } })).toEqual({
      ok: true,
      entries: [{ id: "9120", title: "Dauntless", platforms: ["PS4"], trophies: [0], note: "Closed.", timestamp: 5 }],
    }));

  it("turns a missing or empty note and a missing timestamp into null", () => {
    const res = parseList({ version: 2, list: { a: { ...entry, note: "", timestamp: undefined }, b: { ...entry, note: undefined } } });
    expect(res).toEqual({
      ok: true,
      entries: [
        { id: "a", title: "Dauntless", platforms: ["PS4"], trophies: [0], note: null, timestamp: null },
        { id: "b", title: "Dauntless", platforms: ["PS4"], trophies: [0], note: null, timestamp: 5 },
      ],
    });
  });

  it.each([[{ version: 1, list: { a: entry } }], [{ version: 2, list: {} }], [{ version: 2, list: [] }], ["text"], [null]])(
    "refuses %j",
    (raw) => expect(parseList(raw)).toEqual({ ok: false, error: LIST_INVALID }),
  );

  it("skips malformed entries", () => {
    const { title: _title, ...noTitle } = entry;
    const res = parseList({
      version: 2,
      list: {
        a: noTitle,
        b: { ...entry, trophies: ["1"] },
        c: { ...entry, trophies: [] },
        d: { ...entry, trophies: [-1] },
        ok: entry,
      },
    });
    expect(res).toMatchObject({ ok: true });
    expect(res.ok && res.entries.map((e) => e.id)).toEqual(["ok"]);
  });

  it("skips entries containing a NUL character", () => {
    const res = parseList({ version: 2, list: { a: { ...entry, title: "a\u0000b" }, ok: entry } });
    expect(res.ok && res.entries).toHaveLength(1);
  });

  it("refuses a list with no valid entry", () =>
    expect(parseList({ version: 2, list: { a: { title: 3 } } })).toEqual({ ok: false, error: LIST_INVALID }));
});

describe("isListUrl", () => {
  it.each([
    ["https://a.dev/l.json", true],
    ["http://a.dev/l.json", true],
    ["ftp://a.dev/l", false],
    ["javascript:alert(1)", false],
    ["", false],
    ["not a url", false],
  ])("isListUrl(%s)", (u, ok) => expect(isListUrl(u)).toBe(ok));
});
