import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, ".") },
  },
  test: {
    environment: "node",
    testTimeout: 20000,
    hookTimeout: 20000,
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", ".next", "dist", ".data"],
  },
});
