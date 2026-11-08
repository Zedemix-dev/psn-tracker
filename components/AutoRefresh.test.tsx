// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AutoRefresh } from "@/components/AutoRefresh";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  refresh.mockReset();
});

describe("AutoRefresh", () => {
  it("refreshes every 3 s while a sync is active", async () => {
    render(<AutoRefresh active />);
    await advance(2999);
    expect(refresh).not.toHaveBeenCalled();
    await advance(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    await advance(6000);
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("refreshes once a minute while idle, to notice a sync that starts", async () => {
    render(<AutoRefresh active={false} />);
    await advance(59_999);
    expect(refresh).not.toHaveBeenCalled();
    await advance(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("slows down once the sync is over", async () => {
    const { rerender } = render(<AutoRefresh active />);
    await advance(3000);
    expect(refresh).toHaveBeenCalledTimes(1);
    rerender(<AutoRefresh active={false} />);
    await advance(30_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    await advance(30_000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("skips refreshes while the tab is hidden", async () => {
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    render(<AutoRefresh active />);
    await advance(9000);
    expect(refresh).not.toHaveBeenCalled();
  });
});
