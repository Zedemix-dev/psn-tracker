import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/src/db/client";
import { DEFAULT_UNOBTAINABLE_LIST_URL, settings, titles, unobtainableList } from "@/src/db/schema";
import type { UnobtainableEntry } from "@/src/db/schema";
import { formatDate, formatDateTime } from "@/src/lib/format";
import { LIST_UNREACHABLE } from "@/src/unobtainable/list";
import { getUnobtainableStatus } from "@/src/unobtainable/status";
import { createTestDb } from "@/tests/helpers/db";

const entry = (id: string): UnobtainableEntry => ({
  id,
  title: `Game ${id}`,
  platforms: ["PS4"],
  trophies: [1],
  note: null,
  timestamp: null,
});

function title(id: string, over: { unobtainableCount?: number; hidden?: boolean } = {}) {
  return {
    npCommunicationId: id,
    npServiceName: "trophy",
    name: id,
    iconUrl: "https://img.example/icon.png",
    platforms: ["PS4"],
    trophySetVersion: "1.00",
    ...over,
  };
}

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

describe("getUnobtainableStatus", () => {
  it("not downloaded yet", async () => {
    expect(await getUnobtainableStatus(db)).toEqual({
      url: DEFAULT_UNOBTAINABLE_LIST_URL,
      badge: "Not downloaded yet",
      badgeClass: "",
      detail: null,
      busy: false,
    });
  });

  it("downloading", async () => {
    await db.update(settings).set({ unobtainableRequestedAt: new Date() }).where(eq(settings.id, 1));
    const s = await getUnobtainableStatus(db);
    expect(s.badge).toBe("Downloading…");
    expect(s.busy).toBe(true);
  });

  it("up to date", async () => {
    const d = new Date("2026-11-09T03:12:00Z");
    await db.insert(unobtainableList).values({ id: 1, entries: [entry("1"), entry("2")], downloadedAt: d, attemptedAt: d });
    await db.insert(titles).values([
      title("NPWR1", { unobtainableCount: 2 }),
      title("NPWR2", { unobtainableCount: 1, hidden: true }),
      title("NPWR3"),
    ]);
    const s = await getUnobtainableStatus(db);
    expect(s).toMatchObject({ badge: "Up to date", badgeClass: "valid", busy: false });
    expect(s.detail).toBe(`Downloaded ${formatDateTime(d)} · 2 games in the list · 1 of yours`);
  });

  it("failed with a previous list", async () => {
    const d = new Date("2026-11-08T03:12:00Z");
    const t = new Date("2026-11-09T03:12:00Z");
    await db
      .insert(unobtainableList)
      .values({ id: 1, entries: [entry("1")], downloadedAt: d, attemptedAt: t, error: LIST_UNREACHABLE });
    const s = await getUnobtainableStatus(db);
    expect(s).toMatchObject({ badge: "Download failed", badgeClass: "expired", busy: false });
    expect(s.detail).toBe(`Couldn't reach this address (${formatDateTime(t)}) · still using the list from ${formatDate(d)}`);
  });

  it("failed with no list", async () => {
    const t = new Date("2026-11-09T03:12:00Z");
    await db.insert(unobtainableList).values({ id: 1, attemptedAt: t, error: LIST_UNREACHABLE });
    const s = await getUnobtainableStatus(db);
    expect(s.badge).toBe("Download failed");
    expect(s.detail).toBe(`Couldn't reach this address (${formatDateTime(t)}) · no list available yet`);
  });

  it("a pending request wins over an error", async () => {
    await db.insert(unobtainableList).values({ id: 1, attemptedAt: new Date(), error: LIST_UNREACHABLE });
    await db.update(settings).set({ unobtainableRequestedAt: new Date() }).where(eq(settings.id, 1));
    expect(await getUnobtainableStatus(db)).toMatchObject({ badge: "Downloading…", busy: true });
  });
});
