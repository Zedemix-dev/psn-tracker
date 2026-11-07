import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // PGlite (dev/test database) must not be bundled: it loads its wasm via file URLs.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
