import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EXPORT_TTL_MS, forgetExport } from "@/src/plat-wall/export-memo";

const m = vi.hoisted(() => ({
  isAuthenticated: vi.fn(),
  loadExportInput: vi.fn(),
  renderPlatWallPng: vi.fn(),
}));
vi.mock("@/src/auth/require-session", () => ({ isAuthenticated: m.isAuthenticated }));
vi.mock("@/src/db/client", () => ({ getDb: async () => ({}) }));
vi.mock("@/src/lib/config", () => ({ getConfig: () => ({ mediaDir: "/media" }) }));
vi.mock("@/src/plat-wall/export-input", () => ({ loadExportInput: m.loadExportInput }));
vi.mock("@/src/plat-wall/export-render", () => ({ renderPlatWallPng: m.renderPlatWallPng }));

import { GET } from "@/app/api/plat-wall/export/route";

const get = (qs: string) => GET(new Request(`http://localhost/api/plat-wall/export?${qs}`));

beforeEach(() => {
  vi.useFakeTimers();
  forgetExport();
  m.isAuthenticated.mockResolvedValue(true);
  m.loadExportInput.mockResolvedValue({ input: {}, fileName: "Zmx969-plat-wall-2026-PS5.png" });
  m.renderPlatWallPng.mockReset();
  m.renderPlatWallPng.mockImplementation(async () => Buffer.from("png"));
});
afterEach(() => {
  forgetExport();
  vi.useRealTimers();
});

describe("GET /api/plat-wall/export", () => {
  it("answers 401 without a session", async () => {
    m.isAuthenticated.mockResolvedValue(false);
    expect((await get("year=2026")).status).toBe(401);
  });

  it("answers 400 on invalid parameters", async () => {
    expect((await get("year=abc")).status).toBe(400);
    expect(m.renderPlatWallPng).not.toHaveBeenCalled();
  });

  it("answers 404 when nothing matches", async () => {
    m.loadExportInput.mockResolvedValue(null);
    expect((await get("year=2019")).status).toBe(404);
  });

  it("serves the preview inline, never cached", async () => {
    const res = await get("year=2026&platform=PS5");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Content-Disposition")).toMatch(/^inline/);
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe("png");
  });

  it("serves the download as an attachment", async () => {
    const res = await get("year=2026&platform=PS5&download=1");
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="Zmx969-plat-wall-2026-PS5.png"');
  });

  it("renders once for a preview and its download", async () => {
    await get("year=2026");
    await get("year=2026&download=1&t=123");
    expect(m.renderPlatWallPng).toHaveBeenCalledTimes(1);
  });

  it("renders again for each new preview", async () => {
    await get("year=2026&t=1");
    await get("year=2026&t=2");
    expect(m.renderPlatWallPng).toHaveBeenCalledTimes(2);
  });

  it("does not serve the image of other settings", async () => {
    await get("year=2026");
    await get("year=2025&download=1");
    expect(m.renderPlatWallPng).toHaveBeenCalledTimes(2);
  });

  it("renders again after 10 minutes", async () => {
    await get("year=2026");
    vi.advanceTimersByTime(EXPORT_TTL_MS);
    await get("year=2026&download=1");
    expect(m.renderPlatWallPng).toHaveBeenCalledTimes(2);
  });
});
