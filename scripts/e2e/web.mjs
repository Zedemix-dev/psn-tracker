// Local end-to-end launcher: loads .data/e2e.env (git-ignored), then runs `next dev` on port 3000.
// next dev re-spawns itself with NODE_OPTIONS, which rejects --env-file, hence this wrapper.
import { spawn } from "node:child_process";
process.loadEnvFile(".data/e2e.env");
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-H", "127.0.0.1", "-p", "3000"], {
  stdio: "inherit",
  env: process.env,
});
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code) => process.exit(code ?? 0));
