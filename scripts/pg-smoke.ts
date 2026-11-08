// CI smoke test against a real Postgres (postgres.js paths the PGlite tests cannot cover).
// Usage: DATABASE_URL=postgres://... npx tsx scripts/pg-smoke.ts
import { createDb } from "@/src/db/client";
import { runMigrations } from "@/src/db/migrate";
import { requestSync, takeSyncRequest } from "@/src/settings/repo";

function expect(label: string, actual: boolean, expected: boolean): void {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
  console.log(`ok - ${label}`);
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const db = await createDb(url);
  await runMigrations(db);
  console.log("ok - migrations");
  await requestSync(db, new Date());
  expect("first takeSyncRequest", await takeSyncRequest(db), true);
  expect("second takeSyncRequest", await takeSyncRequest(db), false);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error("pg-smoke failed:", err);
    process.exit(1);
  },
);
