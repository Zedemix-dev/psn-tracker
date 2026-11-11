import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";
import { MEDIA_CSP, SITE_HEADERS } from "./security-headers";

describe("security headers", () => {
  it("refuses framing", () => {
    expect(SITE_HEADERS).toEqual([
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
    ]);
  });
  it("next.config headers() applies them to every path", async () => {
    expect(await nextConfig.headers?.()).toEqual([{ source: "/:path*", headers: SITE_HEADERS }]);
  });
  it("sandboxes media", () => {
    expect(MEDIA_CSP).toBe("default-src 'none'; style-src 'unsafe-inline'; sandbox");
  });
});
