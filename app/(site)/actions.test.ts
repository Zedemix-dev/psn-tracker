import { beforeEach, describe, expect, it, vi } from "vitest";

const saveCabinet = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/src/auth/require-session", () => ({ requireSession: vi.fn(async () => {}) }));
vi.mock("@/src/db/client", () => ({ getDb: vi.fn(async () => ({})) }));
vi.mock("@/src/settings/repo", () => ({ setHideZero: vi.fn() }));
vi.mock("@/src/cabinet/repo", async () => {
  const actual = await vi.importActual<typeof import("@/src/cabinet/repo")>("@/src/cabinet/repo");
  return { ...actual, saveCabinet: (...a: unknown[]) => saveCabinet(...a) };
});

import { saveCabinetAction } from "@/app/(site)/actions";
import { CabinetValidationError } from "@/src/cabinet/repo";

beforeEach(() => {
  saveCabinet.mockReset();
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
