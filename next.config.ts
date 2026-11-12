import type { NextConfig } from "next";
import { MEDIA_CSP, SITE_HEADERS } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // PGlite (dev/test database) must not be bundled: it loads its wasm via file URLs.
  // sharp and fontkit (Plat Wall PNG) are native / font-parsing packages: traced into standalone, not bundled.
  serverExternalPackages: ["@electric-sql/pglite", "sharp", "fontkit"],
  // Known trade-off: the 11 MB serverActions.bodySizeLimit is app-wide (the login action
  // included) and proxyClientMaxBodySize applies to unauthenticated requests too; nginx caps
  // everything at 12 MB. Accepted for a single-user site.
  // Banner uploads are up to 10 MB; leave room for the multipart envelope. The proxy buffers
  // request bodies too (default 10 MB), so it needs the same limit or the upload is truncated.
  // Through headers() (not proxy.ts): the proxy matcher skips the login page, _next/static and the favicon.
  async headers() {
    // Next applies the rules in order and the last one wins per key: the media rule comes second
    // so /media keeps its sandbox CSP instead of the site-wide frame-ancestors one.
    return [
      { source: "/:path*", headers: SITE_HEADERS },
      { source: "/media/:path*", headers: [{ key: "Content-Security-Policy", value: MEDIA_CSP }] },
    ];
  },
  experimental: { serverActions: { bodySizeLimit: "11mb" }, proxyClientMaxBodySize: "11mb" },
};

export default nextConfig;
