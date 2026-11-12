import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { MEDIA_CSP } from "@/src/lib/security-headers";

const m = vi.hoisted(() => ({ dir: "" }));
vi.mock("@/src/auth/require-session", () => ({ isAuthenticated: async () => true }));
vi.mock("@/src/lib/config", () => ({ getConfig: () => ({ mediaDir: m.dir }) }));

import { GET } from "./route";

beforeAll(async () => {
  m.dir = await fs.mkdtemp(path.join(os.tmpdir(), "media-"));
});
afterAll(async () => {
  await fs.rm(m.dir, { recursive: true, force: true });
});

const get = (segments: string[]) =>
  GET(new Request("http://localhost/media"), { params: Promise.resolve({ path: segments }) });

describe("GET /media", () => {
  it.each([["a.png", "image/png"], ["b.svg", "image/svg+xml"]])(
    "serves %s with the sandbox CSP and nosniff",
    async (name, type) => {
      await fs.mkdir(path.join(m.dir, "psn"), { recursive: true });
      await fs.writeFile(path.join(m.dir, "psn", name), "x");
      const res = await get(["psn", name]);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe(type);
      expect(res.headers.get("Content-Security-Policy")).toBe(MEDIA_CSP);
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    },
  );
});
