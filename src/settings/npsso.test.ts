import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/src/db/client";
import { createFakePsn } from "@/tests/fakes/psn";
import { createTestDb } from "@/tests/helpers/db";
import { getSettings } from "@/src/settings/repo";
import { saveNpssoToken, NPSSO_INVALID, NPSSO_REJECTED, NPSSO_SAVED } from "@/src/settings/npsso";

const KEY = Buffer.alloc(32, 7);
const NOW = new Date("2026-11-08T10:00:00Z");
const GOOD = "a".repeat(64);

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe("saveNpssoToken", () => {
  it("rejects a bad pattern without calling PSN", async () => {
    const psn = createFakePsn({});
    const res = await saveNpssoToken(db, psn, KEY, "a".repeat(63), NOW);
    expect(res).toEqual({ ok: false, message: NPSSO_INVALID });
    expect(res.message).toBe("That doesn't look like a 64-character npsso.");
    expect(psn.calls).toEqual([]);
    expect((await getSettings(db)).syncRequestedAt).toBeNull();
  });

  it("trims surrounding whitespace before checking", async () => {
    const psn = createFakePsn({ failures: [{ method: "exchangeNpsso" }] });
    const res = await saveNpssoToken(db, psn, KEY, `  ${GOOD}\n`, NOW);
    expect(res.message).toBe(NPSSO_REJECTED);
    expect(psn.calls).toEqual(["exchangeNpsso:"]);
  });

  it("reports a token PSN refuses and requests no sync", async () => {
    const psn = createFakePsn({ failures: [{ method: "exchangeNpsso" }] });
    const res = await saveNpssoToken(db, psn, KEY, GOOD, NOW);
    expect(res).toEqual({ ok: false, message: NPSSO_REJECTED });
    expect(res.message).toBe("PSN didn't accept this npsso. Sign in again and copy a fresh one.");
    expect((await getSettings(db)).syncRequestedAt).toBeNull();
  });

  it("saves the token and requests a sync", async () => {
    const psn = createFakePsn();
    const res = await saveNpssoToken(db, psn, KEY, GOOD, NOW);
    expect(res).toEqual({ ok: true, message: NPSSO_SAVED });
    expect(res.message).toBe("Token saved. A sync has started.");
    const s = await getSettings(db);
    expect(s.syncRequestedAt).toEqual(NOW);
    expect(s.psnAuthStatus).toBe("valid");
    expect(s.npssoSetAt).toEqual(NOW);
  });
});
