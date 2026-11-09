import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/src/db/client";
import { settings, titles, trophies, unobtainableList } from "@/src/db/schema";
import { saveUnobtainableUrl } from "@/src/settings/repo";
import { LIST_INVALID, LIST_UNREACHABLE } from "@/src/unobtainable/list";
import { downloadList, isListDue, refreshUnobtainableListIfDue } from "@/src/unobtainable/refresh";
import { createTestDb } from "@/tests/helpers/db";

const applyMock = vi.hoisted(() => vi.fn());
vi.mock("@/src/unobtainable/apply", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/src/unobtainable/apply")>();
  applyMock.mockImplementation(original.applyUnobtainable);
  return { applyUnobtainable: (...a: Parameters<typeof original.applyUnobtainable>) => applyMock(...a) };
});

const MIN = 60_000;
const H = 60 * MIN;
const now = new Date("2026-11-09T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

describe("isListDue", () => {
  it.each([
    ["requested, even just attempted", { requestedAt: now, downloadedAt: ago(H), attemptedAt: now }, true],
    ["never attempted", { requestedAt: null, downloadedAt: null, attemptedAt: null }, true],
    ["never downloaded, tried 59 min ago", { requestedAt: null, downloadedAt: null, attemptedAt: ago(59 * MIN) }, false],
    ["never downloaded, tried 1 h ago", { requestedAt: null, downloadedAt: null, attemptedAt: ago(H) }, true],
    ["fresh", { requestedAt: null, downloadedAt: ago(24 * H - MIN), attemptedAt: ago(24 * H - MIN) }, false],
    ["24 h old", { requestedAt: null, downloadedAt: ago(24 * H), attemptedAt: ago(24 * H) }, true],
    ["old but tried 30 min ago", { requestedAt: null, downloadedAt: ago(25 * H), attemptedAt: ago(30 * MIN) }, false],
  ])("%s", (_n, s, want) => expect(isListDue(s, now)).toBe(want));
});

const goodBody = {
  version: 2,
  list: { "1": { title: "Dauntless", platforms: ["PS4"], note: "Closed.", trophies: [0], timestamp: 5 } },
};
const okFetch = () => vi.fn(async () => new Response(JSON.stringify(goodBody))) as unknown as typeof fetch;
const failFetch = () => vi.fn(async () => { throw new Error("offline"); }) as unknown as typeof fetch;

describe("downloadList", () => {
  it("parses a valid list", async () => {
    const res = await downloadList("https://x.example/list.json", okFetch());
    expect(res.ok).toBe(true);
  });

  it("reports a network failure", async () => {
    expect(await downloadList("https://x.example/l", failFetch())).toEqual({ ok: false, error: LIST_UNREACHABLE });
  });

  it("reports an HTTP error", async () => {
    const f = vi.fn(async () => new Response("x", { status: 404 })) as unknown as typeof fetch;
    expect(await downloadList("https://x.example/l", f)).toEqual({ ok: false, error: LIST_UNREACHABLE });
  });

  it("reports non-JSON", async () => {
    const f = vi.fn(async () => new Response("<html>")) as unknown as typeof fetch;
    expect(await downloadList("https://x.example/l", f)).toEqual({ ok: false, error: LIST_INVALID });
  });

  it("never fetches a non-http address", async () => {
    const f = failFetch();
    expect(await downloadList("ftp://x", f)).toEqual({ ok: false, error: LIST_UNREACHABLE });
    expect(f).not.toHaveBeenCalled();
  });

  it("passes a timeout signal", async () => {
    const f = okFetch();
    await downloadList("https://x.example/l", f);
    const init = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("refuses a body over 10 MB without Content-Length", async () => {
    const cancelled = vi.fn();
    const chunk = new Uint8Array(1024 * 1024);
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(chunk);
      },
      cancel: cancelled,
    });
    const f = vi.fn(async () => new Response(stream)) as unknown as typeof fetch;
    expect(await downloadList("https://x.example/l", f)).toEqual({ ok: false, error: LIST_INVALID });
    expect(cancelled).toHaveBeenCalled();
  });
});

describe("refreshUnobtainableListIfDue", () => {
  let db: Db;
  const URL2 = "https://other.example/list.json";
  beforeEach(async () => {
    db = await createTestDb();
    await db.insert(titles).values({
      npCommunicationId: "NPWR1",
      npServiceName: "trophy",
      name: "Dauntless",
      iconUrl: "https://img.example/i.png",
      platforms: ["PS4"],
      trophySetVersion: "1.00",
    });
    await db.insert(trophies).values(
      [0, 1].map((trophyId) => ({
        titleId: "NPWR1",
        trophyId,
        type: "bronze" as const,
        name: `T${trophyId}`,
        iconUrl: "https://img.example/t.png",
      })),
    );
  });

  const list = async () => (await db.select().from(unobtainableList).where(eq(unobtainableList.id, 1)))[0];
  const title = async () => (await db.select().from(titles))[0];
  const requested = async () => (await db.select().from(settings))[0].unobtainableRequestedAt;

  it("stores the list and marks the games", async () => {
    await refreshUnobtainableListIfDue(db, now, okFetch());
    const l = await list();
    expect(l.entries).toHaveLength(1);
    expect(l.downloadedAt).toEqual(now);
    expect(l.attemptedAt).toEqual(now);
    expect(l.error).toBeNull();
    expect((await title()).unobtainableCount).toBe(2);
  });

  it("keeps the old list and marks on failure", async () => {
    await refreshUnobtainableListIfDue(db, now, okFetch());
    const now2 = new Date(now.getTime() + MIN);
    await saveUnobtainableUrl(db, "https://x.example/l", now2);
    await refreshUnobtainableListIfDue(db, now2, failFetch());
    const l = await list();
    expect(l.entries).toHaveLength(1);
    expect(l.downloadedAt).toEqual(now);
    expect(l.attemptedAt).toEqual(now2);
    expect(l.error).toBe(LIST_UNREACHABLE);
    expect((await title()).unobtainableCount).toBe(2);
  });

  it("records a failure when there was no list", async () => {
    await refreshUnobtainableListIfDue(db, now, failFetch());
    const l = await list();
    expect(l.entries).toEqual([]);
    expect(l.error).toBe(LIST_UNREACHABLE);
    expect(l.downloadedAt).toBeNull();
    expect(l.attemptedAt).toEqual(now);
  });

  it("records a failure when storing the list throws", async () => {
    await refreshUnobtainableListIfDue(db, now, okFetch());
    const now2 = new Date(now.getTime() + MIN);
    await saveUnobtainableUrl(db, "https://x.example/l", now2);
    applyMock.mockRejectedValueOnce(new Error("boom"));
    await refreshUnobtainableListIfDue(db, now2, okFetch());
    const l = await list();
    expect(l.attemptedAt).toEqual(now2);
    expect(l.error).toBe(LIST_INVALID);
    expect(l.downloadedAt).toEqual(now);
    expect(l.entries).toHaveLength(1);
    expect(await requested()).toBeNull();
  });

  it("does nothing when not due", async () => {
    await refreshUnobtainableListIfDue(db, now, okFetch());
    const f = okFetch();
    await refreshUnobtainableListIfDue(db, new Date(now.getTime() + MIN), f);
    expect(f).not.toHaveBeenCalled();
  });

  it("clears the request when done", async () => {
    await saveUnobtainableUrl(db, "https://x.example/l", now);
    await refreshUnobtainableListIfDue(db, now, okFetch());
    expect(await requested()).toBeNull();
    const later = new Date(now.getTime() + MIN);
    await saveUnobtainableUrl(db, "https://x.example/l", later);
    await refreshUnobtainableListIfDue(db, later, failFetch());
    expect(await requested()).toBeNull();
  });

  it("keeps a request made during the download", async () => {
    await saveUnobtainableUrl(db, "https://x.example/l", now);
    const later = new Date(now.getTime() + MIN);
    const f = vi.fn(async () => {
      await saveUnobtainableUrl(db, URL2, later);
      return new Response(JSON.stringify(goodBody));
    }) as unknown as typeof fetch;
    await refreshUnobtainableListIfDue(db, now, f);
    expect(await requested()).toEqual(later);
  });
});
