import { beforeEach, describe, expect, it, vi } from "vitest";

const saveCabinet = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));
vi.mock("@/src/auth/require-session", () => ({ requireSession: vi.fn(async () => {}) }));
vi.mock("@/src/db/client", () => ({ getDb: vi.fn(async () => ({})) }));
const setAdvisorHideUnobtainable = vi.fn();
const setAdvisorDlc = vi.fn();
const revalidatePath = vi.fn();
vi.mock("@/src/settings/repo", () => ({
  setHideZero: vi.fn(),
  setAdvisorHideUnobtainable: (...a: unknown[]) => setAdvisorHideUnobtainable(...a),
  setAdvisorDlc: (...a: unknown[]) => setAdvisorDlc(...a),
}));
vi.mock("@/src/cabinet/repo", async () => {
  const actual = await vi.importActual<typeof import("@/src/cabinet/repo")>("@/src/cabinet/repo");
  return { ...actual, saveCabinet: (...a: unknown[]) => saveCabinet(...a) };
});

import { saveCabinetAction, setAdvisorDlcMode, toggleAdvisorHideUnobtainable } from "@/app/(site)/actions";
import { CabinetValidationError } from "@/src/cabinet/repo";

beforeEach(() => {
  saveCabinet.mockReset();
  setAdvisorHideUnobtainable.mockReset();
  setAdvisorDlc.mockReset();
  revalidatePath.mockReset();
});

describe("Trophy Advisor settings actions", () => {
  it("rejects a non-boolean", async () => {
    await expect(toggleAdvisorHideUnobtainable("yes" as never)).rejects.toThrow("Invalid value");
    expect(setAdvisorHideUnobtainable).not.toHaveBeenCalled();
  });

  it("saves a boolean and revalidates the page", async () => {
    await toggleAdvisorHideUnobtainable(true);
    expect(setAdvisorHideUnobtainable).toHaveBeenCalledWith({}, true);
    expect(revalidatePath).toHaveBeenCalledWith("/trophy-advisor");
  });

  it("rejects an unknown DLC mode", async () => {
    await expect(setAdvisorDlcMode("both" as never)).rejects.toThrow("Invalid value");
    expect(setAdvisorDlc).not.toHaveBeenCalled();
  });

  it("saves a valid DLC mode and revalidates the page", async () => {
    await setAdvisorDlcMode("hide");
    expect(setAdvisorDlc).toHaveBeenCalledWith({}, "hide");
    expect(revalidatePath).toHaveBeenCalledWith("/trophy-advisor");
  });
});

describe("saveCabinetAction", () => {
  it("rejects an oversized trophyId before touching the repo", async () => {
    const res = await saveCabinetAction([{ titleId: "A", trophyId: 3e9 }]);
    expect(res).toEqual({ ok: false, error: "Invalid cabinet" });
    expect(saveCabinet).not.toHaveBeenCalled();
  });

  it("passes the repo's validation message through", async () => {
    saveCabinet.mockImplementation(async () => {
      throw new CabinetValidationError("Only earned trophies can be in the cabinet");
    });
    expect(await saveCabinetAction([{ titleId: "A", trophyId: 1 }])).toEqual({
      ok: false,
      error: "Only earned trophies can be in the cabinet",
    });
  });

  it("hides other errors behind a generic message and logs them", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    saveCabinet.mockImplementation(async () => {
      throw new Error("select ... params: 3000000000");
    });
    expect(await saveCabinetAction([{ titleId: "A", trophyId: 1 }])).toEqual({
      ok: false,
      error: "Could not save the cabinet.",
    });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("saves valid entries", async () => {
    saveCabinet.mockResolvedValue(undefined);
    expect(await saveCabinetAction([{ titleId: "A", trophyId: 0 }])).toEqual({ ok: true });
  });
});
