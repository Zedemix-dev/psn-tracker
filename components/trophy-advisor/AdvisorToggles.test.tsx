// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setAdvisorDlcMode, toggleAdvisorHideUnobtainable } from "@/app/(site)/actions";
import { AdvisorToggles } from "@/components/trophy-advisor/AdvisorToggles";

vi.mock("@/app/(site)/actions", () => ({
  toggleAdvisorHideUnobtainable: vi.fn(async () => {}),
  setAdvisorDlcMode: vi.fn(async () => {}),
}));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const box = (name: string) => screen.getByRole("checkbox", { name });

describe("AdvisorToggles", () => {
  it("saves Hide unobtainable and refreshes", async () => {
    render(<AdvisorToggles hideUnobtainable={false} dlc="all" />);
    await act(async () => fireEvent.click(box("Hide unobtainable")));
    expect(toggleAdvisorHideUnobtainable).toHaveBeenCalledWith(true);
    expect(refresh).toHaveBeenCalled();
    expect(box("Hide unobtainable")).toBeChecked();
  });

  it("turning on DLC only turns off Hide DLC, with one save of mode 'only'", async () => {
    render(<AdvisorToggles hideUnobtainable={false} dlc="hide" />);
    expect(box("Hide DLC")).toBeChecked();
    await act(async () => fireEvent.click(box("DLC only")));
    expect(setAdvisorDlcMode).toHaveBeenCalledTimes(1);
    expect(setAdvisorDlcMode).toHaveBeenCalledWith("only");
    expect(box("DLC only")).toBeChecked();
    expect(box("Hide DLC")).not.toBeChecked();
  });

  it("turning on Hide DLC turns off DLC only, with one save of mode 'hide'", async () => {
    render(<AdvisorToggles hideUnobtainable={false} dlc="only" />);
    await act(async () => fireEvent.click(box("Hide DLC")));
    expect(setAdvisorDlcMode).toHaveBeenCalledTimes(1);
    expect(setAdvisorDlcMode).toHaveBeenCalledWith("hide");
    expect(box("Hide DLC")).toBeChecked();
    expect(box("DLC only")).not.toBeChecked();
  });

  it("turning a DLC toggle off saves mode 'all'", async () => {
    render(<AdvisorToggles hideUnobtainable={false} dlc="only" />);
    await act(async () => fireEvent.click(box("DLC only")));
    expect(setAdvisorDlcMode).toHaveBeenCalledWith("all");
    expect(box("DLC only")).not.toBeChecked();
  });

  it("puts both DLC toggles back when the save fails", async () => {
    vi.mocked(setAdvisorDlcMode).mockRejectedValueOnce(new Error("nope"));
    render(<AdvisorToggles hideUnobtainable={false} dlc="hide" />);
    await act(async () => fireEvent.click(box("DLC only")));
    expect(box("Hide DLC")).toBeChecked();
    expect(box("DLC only")).not.toBeChecked();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("puts Hide unobtainable back when the save fails", async () => {
    vi.mocked(toggleAdvisorHideUnobtainable).mockRejectedValueOnce(new Error("nope"));
    render(<AdvisorToggles hideUnobtainable={false} dlc="all" />);
    await act(async () => fireEvent.click(box("Hide unobtainable")));
    expect(box("Hide unobtainable")).not.toBeChecked();
  });

  it("disables the three while a save runs", async () => {
    let resolve!: () => void;
    vi.mocked(setAdvisorDlcMode).mockReturnValueOnce(new Promise<void>((r) => (resolve = r)));
    render(<AdvisorToggles hideUnobtainable={false} dlc="all" />);
    await act(async () => fireEvent.click(box("Hide DLC")));
    for (const name of ["Hide unobtainable", "Hide DLC", "DLC only"]) expect(box(name)).toBeDisabled();
    await act(async () => resolve());
    for (const name of ["Hide unobtainable", "Hide DLC", "DLC only"]) expect(box(name)).toBeEnabled();
  });
});
