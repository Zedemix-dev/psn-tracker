import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config, proxy } from "@/proxy";

const matches = (path: string) => new RegExp(`^${config.matcher[0]}$`).test(path);

describe("proxy", () => {
  it("redirects to /login without a cookie", () => {
    const res = proxy(new NextRequest("http://localhost/"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it("re-emits the cookie for 400 days when present", () => {
    const res = proxy(
      new NextRequest("http://localhost/", { headers: { cookie: "psnt_session=abc" } }),
    );
    const c = res.cookies.get("psnt_session");
    expect(c?.value).toBe("abc");
    expect(c?.maxAge).toBe(400 * 24 * 60 * 60);
    expect(c?.httpOnly).toBe(true);
    expect(c?.secure).toBeFalsy();
  });

  it("marks the cookie secure behind https", () => {
    const res = proxy(
      new NextRequest("http://localhost/", {
        headers: { cookie: "psnt_session=abc", "x-forwarded-proto": "https" },
      }),
    );
    expect(res.cookies.get("psnt_session")?.secure).toBe(true);
  });

  it("matcher skips only /login, _next/static and favicon.ico", () => {
    expect(matches("/")).toBe(true);
    expect(matches("/game/1")).toBe(true);
    expect(matches("/login-help")).toBe(true);
    expect(matches("/loginfoo")).toBe(true);
    expect(matches("/_nextfoo")).toBe(true);
    expect(matches("/favicon.xico")).toBe(true);
    expect(matches("/login")).toBe(false);
    expect(matches("/login/")).toBe(false);
    expect(matches("/_next/static/a.js")).toBe(false);
    expect(matches("/favicon.ico")).toBe(false);
  });
});
