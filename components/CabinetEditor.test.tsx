// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CabinetEditor } from "@/components/CabinetEditor";
import type { TrophyItem } from "@/src/cabinet/item";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, replace: vi.fn() }) }));
const saveCabinetAction = vi.fn();
vi.mock("@/app/(site)/actions", () => ({ saveCabinetAction: (...a: unknown[]) => saveCabinetAction(...a) }));

const item = (n: number): TrophyItem => ({
  key: `A-${n}`,
  titleId: "A",
  trophyId: n,
  name: `Trophy ${n}`,
  game: "Alpha",
  type: "gold",
  iconSrc: "/i.png",
  ratePct: "1.50%",
  tier: "Ultra rare",
});
const items = (from: number, count: number) => Array.from({ length: count }, (_, i) => item(from + i));

let search: TrophyItem[] = [];
beforeEach(() => {
  // jsdom has no <dialog> modal behaviour.
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
  search = [];
  saveCabinetAction.mockReset().mockResolvedValue({ ok: true });
  refresh.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => search }) as Response),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const chosenList = () => within(screen.getByRole("list", { name: "Chosen trophies" }));
const chosenNames = () => chosenList().getAllByRole("listitem").map((li) => li.querySelector(".n")!.textContent);

async function openEditor(initial: TrophyItem[]) {
  render(<CabinetEditor initial={initial} />);
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  return screen.findByRole("dialog", { name: "Edit trophy cabinet" });
}

describe("CabinetEditor", () => {
  it("opens an accessible dialog and searches after the debounce", async () => {
    search = [item(7)];
    const dialog = await openEditor([]);
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby");
    expect(screen.getByLabelText("Search earned trophies")).toHaveFocus();
    fireEvent.change(screen.getByLabelText("Search earned trophies"), { target: { value: "tro phy" } });
    await screen.findByRole("button", { name: "Add Trophy 7" });
    expect(fetch).toHaveBeenLastCalledWith("/api/trophies/search?q=tro%20phy", expect.anything());
  });

  it("adds, moves, removes and saves in the chosen order", async () => {
    search = [item(9)];
    await openEditor(items(1, 3));
    fireEvent.click(await screen.findByRole("button", { name: "Add Trophy 9" }));
    expect(chosenNames()).toEqual(["Trophy 1", "Trophy 2", "Trophy 3", "Trophy 9"]);
    expect(screen.getByRole("button", { name: "Add Trophy 9" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Move up Trophy 9" }));
    fireEvent.click(screen.getByRole("button", { name: "Move down Trophy 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Trophy 2" }));
    expect(chosenNames()).toEqual(["Trophy 1", "Trophy 9", "Trophy 3"]);

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    const sent = saveCabinetAction.mock.calls[0][0];
    expect(sent).toEqual([1, 9, 3].map((trophyId) => ({ titleId: "A", trophyId })));
    expect(screen.getByRole("button", { name: "Edit" })).toHaveFocus();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Cancel and Escape close without saving and return focus to Edit", async () => {
    await openEditor(items(1, 2));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(saveCabinetAction).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Edit" })).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(saveCabinetAction).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("disables Add once 10 are chosen", async () => {
    search = [item(50)];
    await openEditor(items(1, 10));
    expect(await screen.findByRole("button", { name: "Add Trophy 50" })).toBeDisabled();
  });

  it("shows the action's error and stays open", async () => {
    saveCabinetAction.mockResolvedValue({ ok: false, error: "Only earned trophies can be in the cabinet" });
    await openEditor(items(1, 1));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Only earned trophies");
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
