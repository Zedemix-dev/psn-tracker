// CI smoke test against a real Postgres (postgres.js paths the PGlite tests cannot cover).
// Usage: DATABASE_URL=postgres://... npx tsx scripts/pg-smoke.ts
import { eq } from "drizzle-orm";
import { createDb, type Db } from "@/src/db/client";
import { runMigrations } from "@/src/db/migrate";
import { titles, trophies } from "@/src/db/schema";
import { requestSync, takeSyncRequest } from "@/src/settings/repo";
import { countLoggedTrophies, queryTrophyLog } from "@/src/trophy-log/load";
import { DEFAULT_LOG_QUERY } from "@/src/trophy-log/query";

function expect<T extends boolean | string>(label: string, actual: T, expected: T): void {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
  console.log(`ok - ${label}`);
}

const SMOKE_TITLE = "SMOKE_TL_00";

/**
 * The Trophy Log query on this engine: the PGlite tests run with collation "C", a real Postgres
 * (the NAS) does not. Seeded under an id no real title has, in 2099 so the rows are the newest,
 * and deleted at the end.
 */
async function smokeTrophyLog(db: Db): Promise<void> {
  const base = await countLoggedTrophies(db);
  try {
    await db.insert(titles).values({
      npCommunicationId: SMOKE_TITLE,
      npServiceName: "trophy",
      name: "Smoke Test Game",
      iconUrl: "https://img.example/icon.png",
      platforms: ["PS5"],
      trophySetVersion: "1.00",
      definedBronze: 5,
      earnedBronze: 4,
      progress: 100,
      hidden: false,
    });
    // [trophyId, name, type, earned at]: the platinum shares its second with "apple".
    const seeds: [number, string, "bronze" | "platinum", string][] = [
      [1, " Journeyman", "bronze", "2099-01-01T10:00:00Z"],
      [2, '"A hero"', "bronze", "2099-01-01T10:00:10Z"],
      [3, "À On", "platinum", "2099-01-01T10:00:20.200Z"],
      [4, "apple", "bronze", "2099-01-01T10:00:20.800Z"],
      [5, "Zebra", "bronze", "2099-01-01T10:00:30Z"],
    ];
    await db.insert(trophies).values(
      seeds.map(([trophyId, name, type, at]) => ({
        titleId: SMOKE_TITLE,
        trophyId,
        groupId: "default",
        type,
        name,
        detail: `Do ${name}`,
        iconUrl: `https://img.example/t${trophyId}.png`,
        earned: true,
        earnedAt: new Date(at),
        earnedRate: "10.00",
        unobtainable: false,
      })),
    );
    const total = await countLoggedTrophies(db);
    expect("seeded trophies are logged", String(total - base), "5");
    const mine = async (query: typeof DEFAULT_LOG_QUERY) =>
      (await queryTrophyLog(db, query, { offset: 0, limit: total })).items.filter((r) => r.gameId === SMOKE_TITLE);

    const alpha = await mine({ ...DEFAULT_LOG_QUERY, sort: "alphabetical", order: "asc" });
    expect(
      "alphabetical order",
      alpha.map((r) => r.name).join("|"),
      ['"A hero"', "À On", "apple", " Journeyman", "Zebra"].join("|"),
    );
    const newest = await mine(DEFAULT_LOG_QUERY);
    expect("newest first", newest.map((r) => r.name).join("|"), ["Zebra", "À On", "apple", '"A hero"', " Journeyman"].join("|"));
    // "apple" and the platinum share a second: the platinum is numbered after it (apple 3, À On 4).
    expect("numbers", newest.map((r) => r.n - base).join(","), "5,4,3,2,1");
  } finally {
    await db.delete(trophies).where(eq(trophies.titleId, SMOKE_TITLE));
    await db.delete(titles).where(eq(titles.npCommunicationId, SMOKE_TITLE));
  }
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
  await smokeTrophyLog(db);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error("pg-smoke failed:", err);
    process.exit(1);
  },
);
