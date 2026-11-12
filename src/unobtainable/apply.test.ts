import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/src/db/client";
import { titles, trophies, unobtainableList } from "@/src/db/schema";
import type { UnobtainableEntry } from "@/src/db/schema";
import { applyUnobtainable } from "@/src/unobtainable/apply";
import { createTestDb } from "@/tests/helpers/db";

const ID = "NPWR1";

function entry(over: Partial<UnobtainableEntry> = {}): UnobtainableEntry {
  return { id: "1", title: "Gran Turismo Sport", platforms: ["PS4"], trophies: [1, 3], note: "Closed.", timestamp: 1, ...over };
}

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await db.insert(titles).values({
    npCommunicationId: ID,
    npServiceName: "trophy",
    name: "Gran Turismo Sport",
    iconUrl: "https://img.example/icon.png",
    platforms: ["PS4"],
    trophySetVersion: "1.00",
  });
  await db.insert(trophies).values(
    [0, 1, 2, 3, 4].map((trophyId) => ({
      titleId: ID,
      trophyId,
      type: "bronze" as const,
      name: `Trophy ${trophyId}`,
      iconUrl: "https://img.example/t.png",
    })),
  );
});

async function setList(entries: UnobtainableEntry[]) {
  await db
    .insert(unobtainableList)
    .values({ id: 1, entries })
    .onConflictDoUpdate({ target: unobtainableList.id, set: { entries } });
}

async function marked(): Promise<number[]> {
  const rows = await db.select().from(trophies).where(eq(trophies.titleId, ID)).orderBy(trophies.trophyId);
  return rows.filter((r) => r.unobtainable).map((r) => r.trophyId);
}

async function title() {
  return (await db.select().from(titles).where(eq(titles.npCommunicationId, ID)))[0];
}

describe("applyUnobtainable", () => {
  it("applyUnobtainable stamps applied_at with its writes", async () => {
    await setList([entry()]);
    const before = Date.now();
    await applyUnobtainable(db);
    const [list] = await db.select().from(unobtainableList);
    expect(list.appliedAt).not.toBeNull();
    expect(list.appliedAt!.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("does not stamp when there is nothing to apply", async () => {
    await applyUnobtainable(db);
    expect(await db.select().from(unobtainableList)).toEqual([]);
  });

  it("marks number minus one and summarises the title", async () => {
    await setList([entry()]);
    await applyUnobtainable(db);
    expect(await marked()).toEqual([0, 2]);
    const t = await title();
    expect(t.unobtainableCount).toBe(2);
    expect(t.unobtainableNote).toBe("Closed.");
  });

  it("marks every trophy for [0]", async () => {
    await setList([entry({ trophies: [0] })]);
    await applyUnobtainable(db);
    expect(await marked()).toEqual([0, 1, 2, 3, 4]);
    expect((await title()).unobtainableCount).toBe(5);
  });

  it("leaves a game whose numbers match nothing unmarked", async () => {
    await setList([entry({ trophies: [99] })]);
    await applyUnobtainable(db);
    expect(await marked()).toEqual([]);
    const t = await title();
    expect(t.unobtainableCount).toBe(0);
    expect(t.unobtainableNote).toBeNull();
  });

  it("clears a game the list no longer names", async () => {
    await setList([entry()]);
    await applyUnobtainable(db);
    await setList([]);
    await applyUnobtainable(db);
    expect(await marked()).toEqual([]);
    const t = await title();
    expect(t.unobtainableCount).toBe(0);
    expect(t.unobtainableNote).toBeNull();
  });

  it("does nothing without a list", async () => {
    await expect(applyUnobtainable(db)).resolves.toBeUndefined();
    expect((await title()).unobtainableCount).toBe(0);
  });
});
