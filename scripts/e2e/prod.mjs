// Local production launcher: loads .data/e2e.env (git-ignored), then runs `next start` on 127.0.0.1:3000.
// Run `npm run build` first. Same wrapper as web.mjs, which runs `next dev`.
import { spawn } from "node:child_process";
process.loadEnvFile(".data/e2e.env");
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", "3000"], {
  stdio: "inherit",
  env: process.env,
});
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code) => process.exit(code ?? 0));
