// CI check: the bundled worker (dist/worker.js) really starts. It runs the worker with the job's
// environment, waits for "[worker] started" (printed after the migrations and the interrupted-run
// cleanup), stops it, and exits 0. Otherwise (early exit, no line within 30 s) it prints the worker
// output and exits 1. The worker never outlives this script.
// Usage: node scripts/worker-smoke.mjs [path/to/worker.js]   (default: dist/worker.js)
import { spawn } from "node:child_process";

const file = process.argv[2] ?? "dist/worker.js";
const TIMEOUT_MS = Number(process.env.WORKER_SMOKE_TIMEOUT_MS ?? 30_000);
const MARKER = "[worker] started";

const child = spawn(process.execPath, [file], { stdio: ["ignore", "pipe", "pipe"] });
let output = "";
let settled = false;

function finish(code, message) {
  if (settled) return;
  settled = true;
  clearTimeout(timer);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
  }
  if (code !== 0) console.error(`--- worker output ---\n${output}\n--- end ---`);
  console.log(message);
  process.exitCode = code;
}

const onData = (chunk) => {
  output += chunk.toString();
  if (output.includes(MARKER)) {
    // Ask politely first so the worker logs its stop, then make sure it is gone.
    child.once("exit", () => finish(0, "ok - worker started and was stopped"));
    child.kill("SIGTERM");
    setTimeout(() => finish(0, "ok - worker started (killed after grace period)"), 5000).unref();
  }
};
child.stdout.on("data", onData);
child.stderr.on("data", onData);
child.on("error", (err) => {
  output += String(err);
  finish(1, "not ok - could not start the worker");
});
child.on("exit", (code, signal) => {
  if (!output.includes(MARKER)) finish(1, `not ok - worker exited early (code ${code}, signal ${signal})`);
});
const timer = setTimeout(
  () => finish(1, `not ok - no "${MARKER}" within ${TIMEOUT_MS / 1000} s`),
  TIMEOUT_MS,
);
process.on("exit", () => {
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
});
