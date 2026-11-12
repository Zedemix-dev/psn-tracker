// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HideZeroToggle } from "@/components/HideZeroToggle";

const refresh = vi.fn();
const toggleHideZero = vi.fn<(next: boolean) => Promise<void>>();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/app/(site)/actions", () => ({ toggleHideZero: (n: boolean) => toggleHideZero(n) }));

afterEach(() => {
  cleanup();
  refresh.mockReset();
  toggleHideZero.mockReset();
});

describe("<HideZeroToggle>", () => {
  it("keeps focus, its name and its state while saving and after", async () => {
    let resolve!: () => void;
    toggleHideZero.mockReturnValueOnce(new Promise<void>((r) => (resolve = r)));
    render(<HideZeroToggle checked={false} />);
    const box = screen.getByRole("checkbox", { name: "Hide 0% games" });
    box.focus();
    expect(box).toHaveFocus();

    fireEvent.click(box);
    expect(toggleHideZero).toHaveBeenCalledWith(true);
    expect(screen.getByRole("checkbox", { name: "Hide 0% games" })).toBe(box);
    expect(box).toBeEnabled();
    expect(box).toHaveFocus();
    expect(box).toBeChecked();

    await act(async () => resolve());
    expect(screen.getByRole("checkbox", { name: "Hide 0% games" })).toBe(box);
    expect(box).toHaveFocus();
    expect(box).toBeChecked();
    expect(refresh).toHaveBeenCalled();
  });

  it("goes back to its previous state when saving fails", async () => {
    toggleHideZero.mockRejectedValueOnce(new Error("x"));
    render(<HideZeroToggle checked={false} />);
    const box = screen.getByRole("checkbox");
    await act(async () => fireEvent.click(box));
    expect(box).not.toBeChecked();
  });
});
