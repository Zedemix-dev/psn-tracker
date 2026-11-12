import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  db: {},
  mediaDir: "",
  bannerPath: null as string | null,
  setBanner: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/src/auth/require-session", () => ({ requireSession: async () => undefined }));
vi.mock("@/src/auth/sessions", () => ({ deleteAllSessions: vi.fn() }));
vi.mock("@/src/db/client", () => ({ getDb: async () => m.db }));
vi.mock("@/src/lib/config", () => ({ getConfig: () => ({ mediaDir: m.mediaDir }) }));
vi.mock("@/src/psn/gateway", () => ({ createPsnGateway: vi.fn() }));
vi.mock("@/src/settings/repo", () => ({
  getSettings: async () => ({ bannerPath: m.bannerPath, bannerPosY: 40 }),
  saveUnobtainableUrl: vi.fn(),
  setBanner: m.setBanner,
}));

import { uploadBanner } from "@/app/(site)/(banner)/settings/actions";

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

describe("uploadBanner", () => {
  beforeEach(async () => {
    m.mediaDir = await fs.mkdtemp(path.join(os.tmpdir(), "banner-action-"));
    m.setBanner.mockReset();
  });
  afterEach(async () => {
    await fs.rm(m.mediaDir, { recursive: true, force: true });
  });

  it("stores the new banner and removes the previous file", async () => {
    await fs.mkdir(path.join(m.mediaDir, "banner"), { recursive: true });
    await fs.writeFile(path.join(m.mediaDir, "banner", "old.png"), PNG);
    m.bannerPath = "banner/old.png";
    const form = new FormData();
    form.set("banner", new File([PNG], "new.png", { type: "image/png" }));

    const res = await uploadBanner(null, form);

    expect(res).toEqual({ ok: true, message: "Banner updated." });
    expect(m.setBanner).toHaveBeenCalledWith(m.db, expect.stringMatching(/^banner\/[0-9a-f]{16}\.png$/), 40);
    const files = await fs.readdir(path.join(m.mediaDir, "banner"));
    expect(files).toHaveLength(1);
    expect(files).not.toContain("old.png");
    expect(`banner/${files[0]}`).toBe(m.setBanner.mock.calls[0][1]);
  });
});
