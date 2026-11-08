import { getDb } from "@/src/db/client";
import { runMigrations } from "@/src/db/migrate";
import { getConfig } from "@/src/lib/config";
import { createPsnGateway } from "@/src/psn/gateway";
import { defaultTickDeps, markInterruptedRuns, tick } from "@/src/worker/scheduler";

const TICK_MS = 5000;

async function main(): Promise<void> {
  const cfg = getConfig();
  const db = await getDb();
  await runMigrations(db);
  await markInterruptedRuns(db, new Date());
  const deps = defaultTickDeps({ db, gw: createPsnGateway(cfg.psnLanguage), cfg });

  let stopping = false;
  let timer: NodeJS.Timeout | undefined;
  let resolveDone!: () => void;
  const done = new Promise<void>((r) => (resolveDone = r));

  const loop = async (): Promise<void> => {
    timer = undefined;
    try {
      await tick(deps, new Date());
    } catch (err) {
      console.error("[worker] tick failed:", err);
    }
    if (stopping) resolveDone();
    else timer = setTimeout(loop, TICK_MS);
  };

  const stop = () => {
    if (stopping) return;
    stopping = true;
    console.log("[worker] stopping");
    if (timer) {
      clearTimeout(timer);
      resolveDone();
    }
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);

  console.log("[worker] started");
  void loop();
  await done;
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error("[worker] fatal:", err);
    process.exit(1);
  },
);
