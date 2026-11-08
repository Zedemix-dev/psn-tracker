import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // PGlite (dev/test database) must not be bundled: it loads its wasm via file URLs.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Banner uploads are up to 10 MB; leave room for the multipart envelope. The proxy buffers
  // request bodies too (default 10 MB), so it needs the same limit or the upload is truncated.
  experimental: { serverActions: { bodySizeLimit: "11mb" }, proxyClientMaxBodySize: "11mb" },
};

export default nextConfig;
