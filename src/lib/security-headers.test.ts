import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";
import { MEDIA_CSP, SITE_HEADERS } from "./security-headers";

/** Next applies the config rules in order; for a given key the last matching rule wins. */
async function headersFor(pathname: string): Promise<Record<string, string>> {
  const merged: Record<string, string> = {};
  for (const rule of (await nextConfig.headers?.()) ?? []) {
    if (!getPathMatch(rule.source)(pathname)) continue;
    for (const { key, value } of rule.headers) merged[key.toLowerCase()] = value;
  }
  return merged;
}

describe("security headers", () => {
  it("refuses framing", () => {
    expect(SITE_HEADERS).toEqual([
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
      { key: "Referrer-Policy", value: "same-origin" },
      { key: "X-Content-Type-Options", value: "nosniff" },
    ]);
  });
  it("next.config headers() applies the site headers to every path, then the media CSP", async () => {
    expect(await nextConfig.headers?.()).toEqual([
      { source: "/:path*", headers: SITE_HEADERS },
      { source: "/media/:path*", headers: [{ key: "Content-Security-Policy", value: MEDIA_CSP }] },
    ]);
  });
  it("sandboxes media and forbids framing it", () => {
    expect(MEDIA_CSP).toBe("default-src 'none'; style-src 'unsafe-inline'; sandbox; frame-ancestors 'none'");
  });
  it("after the merge, media keeps its sandbox CSP", async () => {
    for (const p of ["/media/psn/a.svg", "/media"]) {
      expect((await headersFor(p))["content-security-policy"]).toBe(MEDIA_CSP);
    }
  });
  it("after the merge, other paths get frame-ancestors none", async () => {
    for (const p of ["/", "/login", "/mediafoo", "/_next/static/x.js"]) {
      const h = await headersFor(p);
      expect(h["content-security-policy"]).toBe("frame-ancestors 'none'");
      expect(h["x-frame-options"]).toBe("DENY");
    }
  });
  it("after the merge, every path gets the referrer policy and nosniff", async () => {
    for (const p of ["/", "/login", "/api/games", "/media/psn/a.svg", "/_next/static/x.js"]) {
      const h = await headersFor(p);
      expect(h["referrer-policy"]).toBe("same-origin");
      expect(h["x-content-type-options"]).toBe("nosniff");
    }
  });
  it("does not advertise Next.js", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});
