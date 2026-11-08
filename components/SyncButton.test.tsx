// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SyncButton } from "@/components/SyncButton";
import type { SyncStatus } from "@/src/sync/requests";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const status = (s: Partial<SyncStatus>): SyncStatus => ({
  status: "idle",
  lastSuccessAt: null,
  error: null,
  titlesDone: 0,
  titlesTotal: 0,
  ...s,
});
const reply = (s: SyncStatus, code = 200) => new Response(JSON.stringify(s), { status: code });

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  refresh.mockReset();
});

const button = () => screen.getByRole("button");
const flush = () => act(() => vi.advanceTimersByTimeAsync(0));

describe("SyncButton", () => {
  it("goes Sync now -> Syncing… -> Sync now once the server is idle, then refreshes", async () => {
    fetchMock
      .mockResolvedValueOnce(reply(status({ status: "queued" }), 202)) // POST
      .mockResolvedValueOnce(reply(status({ status: "running" }))) // poll 1
      .mockResolvedValueOnce(reply(status({ status: "idle", lastSuccessAt: "2026-11-07T08:27:00Z" }))); // poll 2
    render(<SyncButton initial={status({})} />);
    expect(button()).toHaveTextContent("Sync now");

    await act(async () => button().click());
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/sync", { method: "POST" });
    expect(button()).toHaveTextContent("Syncing…");
    expect(button()).toBeDisabled();

    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/sync", { cache: "no-store" });
    expect(button()).toHaveTextContent("Syncing…");
    expect(refresh).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(button()).toHaveTextContent("Sync now");
    expect(refresh).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("polls from the start when the server says a sync is already running", async () => {
    fetchMock.mockResolvedValue(reply(status({ status: "idle" })));
    render(<SyncButton initial={status({ status: "running" })} />);
    expect(button()).toHaveTextContent("Syncing…");
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(button()).toHaveTextContent("Sync now");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("refreshes when a sync finished elsewhere while the page was idle", async () => {
    fetchMock.mockResolvedValue(reply(status({ lastSuccessAt: "2026-11-07T14:00:00Z" })));
    render(<SyncButton initial={status({ lastSuccessAt: "2026-11-07T08:00:00Z" })} />);
    await act(() => vi.advanceTimersByTimeAsync(59_000));
    expect(fetchMock).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(fetchMock).toHaveBeenCalledWith("/api/sync", { cache: "no-store" });
    expect(screen.getByText("Last synced 7 Nov 2026, 15:00")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does not refresh while idle when nothing new was synced", async () => {
    fetchMock.mockResolvedValue(reply(status({ lastSuccessAt: "2026-11-07T08:00:00Z" })));
    render(<SyncButton initial={status({ lastSuccessAt: "2026-11-07T08:00:00Z" })} />);
    await act(() => vi.advanceTimersByTimeAsync(120_000));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("follows an automatic sync that starts while the page is open", async () => {
    fetchMock
      .mockResolvedValueOnce(reply(status({ status: "running", lastSuccessAt: "2026-11-07T08:00:00Z" })))
      .mockResolvedValueOnce(reply(status({ lastSuccessAt: "2026-11-07T14:00:00Z" })));
    render(<SyncButton initial={status({ lastSuccessAt: "2026-11-07T08:00:00Z" })} />);
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(button()).toHaveTextContent("Syncing…");
    expect(refresh).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(button()).toHaveTextContent("Sync now");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("offers a retry and shows the message when the sync failed", async () => {
    fetchMock.mockResolvedValue(reply(status({ status: "error", error: "PSN down" })));
    render(<SyncButton initial={status({ status: "error", error: "PSN down" })} />);
    expect(button()).toHaveTextContent("Retry sync");
    expect(screen.getByText("Last sync failed: PSN down")).toBeInTheDocument();
    expect(screen.queryByText(/Last synced/)).toBeNull();
  });

  it("shows the last sync date, or Never synced", async () => {
    render(<SyncButton initial={status({ lastSuccessAt: "2026-11-07T08:27:00Z" })} />);
    expect(screen.getByText("Last synced 7 Nov 2026, 09:27")).toBeInTheDocument();
    cleanup();
    render(<SyncButton initial={status({})} />);
    expect(screen.getByText("Never synced")).toBeInTheDocument();
  });

  it("falls back to the error state when the POST fails", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    render(<SyncButton initial={status({})} />);
    await act(async () => button().click());
    await flush();
    expect(button()).toHaveTextContent("Retry sync");
  });
});
