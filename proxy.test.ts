import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbReady = vi.hoisted(() => ({ value: true }));
vi.mock("@/src/db/client", () => ({ getDb: async () => ({}) }));
vi.mock("@/src/db/readiness", () => ({ isDbReady: async () => dbReady.value }));

import { config, proxy } from "@/proxy";

const matches = (path: string) => new RegExp(`^${config.matcher[0]}$`).test(path);

beforeEach(() => {
  dbReady.value = true;
});

describe("proxy", () => {
  it("redirects to /login without a cookie", async () => {
    const res = await proxy(new NextRequest("http://localhost/"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it("re-emits the cookie for 400 days when present", async () => {
    const res = await proxy(
      new NextRequest("http://localhost/", { headers: { cookie: "psnt_session=abc" } }),
    );
    const c = res.cookies.get("psnt_session");
    expect(c?.value).toBe("abc");
    expect(c?.maxAge).toBe(400 * 24 * 60 * 60);
    expect(c?.httpOnly).toBe(true);
    expect(c?.secure).toBeFalsy();
  });

  it("marks the cookie secure behind https", async () => {
    const res = await proxy(
      new NextRequest("http://localhost/", {
        headers: { cookie: "psnt_session=abc", "x-forwarded-proto": "https" },
      }),
    );
    expect(res.cookies.get("psnt_session")?.secure).toBe(true);
  });

  it("lets /login through without a cookie when the database is ready", async () => {
    const res = await proxy(new NextRequest("http://localhost/login"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("matcher skips only media, _next/static, _next/image and favicon.ico", () => {
    expect(matches("/")).toBe(true);
    expect(matches("/game/1")).toBe(true);
    expect(matches("/login")).toBe(true);
    expect(matches("/api/plat-wall.png")).toBe(true);
    expect(matches("/login-help")).toBe(true);
    expect(matches("/_nextfoo")).toBe(true);
    expect(matches("/mediafoo")).toBe(true);
    expect(matches("/favicon.xico")).toBe(true);
    expect(matches("/media/abc.png")).toBe(false);
    expect(matches("/_next/static/a.js")).toBe(false);
    expect(matches("/_next/image")).toBe(false);
    expect(matches("/favicon.ico")).toBe(false);
  });

  describe("database not ready", () => {
    beforeEach(() => {
      dbReady.value = false;
    });

    it.each(["/", "/game/1", "/login"])("answers %s with the wait page", async (path) => {
      const res = await proxy(new NextRequest(`http://localhost${path}`));
      expect(res.status).toBe(503);
      expect(res.headers.get("content-type")).toContain("text/html");
      const html = await res.text();
      expect(html).toContain("Updating…");
      expect(html).toContain("This page reloads by itself.");
      expect(html).toContain('<meta http-equiv="refresh" content="5">');
    });

    it("answers /api routes with a bare 503", async () => {
      const res = await proxy(new NextRequest("http://localhost/api/plat-wall.png"));
      expect(res.status).toBe(503);
      expect(await res.text()).toBe("");
      expect(res.headers.get("content-type") ?? "").not.toContain("html");
    });
  });
});
