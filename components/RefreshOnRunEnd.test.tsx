// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RefreshOnRunEnd } from "@/components/RefreshOnRunEnd";
import type { SyncStatus } from "@/src/sync/requests";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const T1 = "2026-11-07T08:00:00.000Z";
const T2 = "2026-11-07T08:05:00.000Z";

const status = (s: Partial<SyncStatus>): SyncStatus => ({
  status: "idle",
  lastSuccessAt: null,
  lastFinishedAt: null,
  error: null,
  titlesDone: 0,
  titlesTotal: 0,
  ...s,
});
const reply = (s: SyncStatus) => new Response(JSON.stringify(s), { status: 200 });

const fetchMock = vi.fn<typeof fetch>();
const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fetchMock.mockReset();
  refresh.mockReset();
});

describe("RefreshOnRunEnd", () => {
  it("refreshes once when a run ends in success", async () => {
    fetchMock
      .mockResolvedValueOnce(reply(status({ status: "running", lastFinishedAt: T1 })))
      .mockResolvedValue(reply(status({ status: "idle", lastSuccessAt: T2, lastFinishedAt: T2 })));
    render(<RefreshOnRunEnd active lastFinishedAt={T1} />);
    await advance(3000);
    expect(fetchMock).toHaveBeenCalledWith("/api/sync", { cache: "no-store" });
    expect(refresh).not.toHaveBeenCalled(); // still running: no redraw
    await advance(3000);
    expect(refresh).toHaveBeenCalledTimes(1);
    await advance(120_000);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("refreshes once when a run ends in error", async () => {
    fetchMock
      .mockResolvedValueOnce(reply(status({ status: "running", lastFinishedAt: T1 })))
      .mockResolvedValue(reply(status({ status: "error", error: "PSN down", lastFinishedAt: T2 })));
    render(<RefreshOnRunEnd active lastFinishedAt={T1} />);
    await advance(6000);
    expect(refresh).toHaveBeenCalledTimes(1);
    await advance(120_000);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("refreshes when a whole run happened between two idle polls", async () => {
    fetchMock.mockResolvedValue(reply(status({ status: "idle", lastFinishedAt: T2 })));
    render(<RefreshOnRunEnd active={false} lastFinishedAt={T1} />);
    await advance(59_999);
    expect(fetchMock).not.toHaveBeenCalled();
    await advance(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("never refreshes while nothing ends", async () => {
    fetchMock.mockResolvedValue(reply(status({ status: "running", lastFinishedAt: T1 })));
    render(<RefreshOnRunEnd active lastFinishedAt={T1} />);
    await advance(30_000);
    expect(fetchMock).toHaveBeenCalledTimes(10);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("does not poll while the tab is hidden", async () => {
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    render(<RefreshOnRunEnd active lastFinishedAt={T1} />);
    await advance(9000);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
