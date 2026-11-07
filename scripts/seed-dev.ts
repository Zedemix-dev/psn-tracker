import fs from "node:fs";
import path from "node:path";
import { createDb } from "@/src/db/client";
import { runMigrations } from "@/src/db/migrate";
import { cabinet, profile, titles, trophies, trophyGroups, type TrophyType } from "@/src/db/schema";
import { isSafeSeedTarget } from "./seed-guard";
import { CABINET, GAMES, RAREST, RECENT } from "./seed-data";

// Fills the dev database with the data of mockup v12 so the UI has something to show.
// No images are stored: every picture falls back to the placeholder. Wipes and re-inserts.

const DAY = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const TYPE_OF = { plat: "platinum", gold: "gold", silver: "silver", bronze: "bronze" } as const;
const RAREST_TYPES = ["gold", "plat", "silver", "silver", "silver"] as const;
const FILLER_SPAN_DAYS = 120;

type TitleRow = typeof titles.$inferInsert;
type TrophyRow = typeof trophies.$inferInsert;

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** "5 Nov 2026" -> noon UTC that day. */
function parseDay(s: string): Date {
  const [d, m, y] = s.split(" ");
  return new Date(Date.UTC(Number(y), MONTHS.indexOf(m), Number(d), 12));
}

/** "4 Nov 2026, 21:30" (Paris, UTC+1 in November) -> Date. */
function parseParis(s: string): Date {
  const [day, time] = s.split(", ");
  const [h, min] = time.split(":").map(Number);
  const [d, m, y] = day.split(" ");
  return new Date(Date.UTC(Number(y), MONTHS.indexOf(m), Number(d), h - 1, min));
}

/** "33h 27m" / "5m" -> seconds. */
function parsePlayTime(s: string | undefined): number | null {
  if (!s) return null;
  const h = /(\d+)h/.exec(s);
  const m = /(\d+)m/.exec(s);
  return (h ? Number(h[1]) * 3600 : 0) + (m ? Number(m[1]) * 60 : 0);
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required (e.g. pglite:./.data/dev)");
  if (!isSafeSeedTarget(url, process.argv.slice(2))) {
    throw new Error("Refusing to wipe a non-local database. Pass --force if you really mean it.");
  }
  if (url.startsWith("pglite:") && url !== "pglite:memory") {
    fs.mkdirSync(path.dirname(path.resolve(url.slice("pglite:".length))), { recursive: true });
  }
  const db = await createDb(url);
  await runMigrations(db);

  const rand = mulberry32(969);
  const titleRows: TitleRow[] = [];
  const trophyRows: TrophyRow[] = [];
  const nextId = new Map<string, number>();
  const idByName = new Map<string, string>();

  const addTrophy = (
    titleId: string,
    type: TrophyType,
    name: string,
    detail: string,
    rate: number,
    earnedAt: Date,
  ) => {
    const trophyId = (nextId.get(titleId) ?? 0) + 1;
    nextId.set(titleId, trophyId);
    trophyRows.push({
      titleId,
      trophyId,
      type,
      name,
      detail,
      iconUrl: `https://seed.invalid/trophy/${titleId}/${trophyId}.png`,
      earned: true,
      earnedAt,
      earnedRate: rate.toFixed(2),
    });
  };

  // The games of the mockup, in list order.
  GAMES.forEach((g, k) => {
    const id = `NPWR_SEED_${String(k + 1).padStart(2, "0")}`;
    if (!idByName.has(g.n)) idByName.set(g.n, id);
    const [ep, dp, eg, dg, es, ds, eb, db_] = g.c;
    const last = parseDay(g.last);
    const recents = RECENT.filter((r) => r.g === g.n);
    // The real "latest trophies" of this game first, then filler for the rest of its earned counts.
    const toFill: Record<TrophyType, number> = { platinum: ep, gold: eg, silver: es, bronze: eb };
    for (const r of recents) {
      const type = TYPE_OF[r.t];
      addTrophy(id, type, r.n, r.d, r.r, parseParis(r.w));
      toFill[type] -= 1;
    }
    const firstRecent = recents.length
      ? Math.min(...recents.map((r) => parseParis(r.w).getTime()))
      : Infinity;
    const end = Math.min(last.getTime(), firstRecent) - (recents.length ? 3 * DAY : 0);
    const start = end - FILLER_SPAN_DAYS * DAY;
    for (const type of ["bronze", "silver", "gold", "platinum"] as const) {
      for (let n = 0; n < Math.max(0, toFill[type]); n++) {
        const at = type === "platinum" ? end : start + rand() * (end - start - 3_600_000);
        const rate = type === "platinum" ? 5 + rand() * 55 : 3 + rand() * 87;
        addTrophy(id, type, `${g.n} ${type} ${n + 1}`, "Seeded filler trophy.", rate, new Date(at));
      }
    }
    const times = trophyRows.filter((t) => t.titleId === id).map((t) => t.earnedAt!.getTime());
    titleRows.push({
      npCommunicationId: id,
      npServiceName: g.p === "PS5" ? "trophy2" : "trophy",
      name: g.n,
      iconUrl: `https://seed.invalid/game/${id}.png`,
      platforms: [g.p],
      trophySetVersion: "01.00",
      definedPlatinum: dp,
      definedGold: dg,
      definedSilver: ds,
      definedBronze: db_,
      earnedPlatinum: ep,
      earnedGold: eg,
      earnedSilver: es,
      earnedBronze: eb,
      progress: g.pr,
      lastTrophyAt: times.length ? new Date(Math.max(...times)) : null,
      firstTrophyAt: times.length ? new Date(Math.min(...times)) : null,
      psnLastUpdatedAt: last,
      playSeconds: parsePlayTime(g.h),
      playCount: g.h ? 1 : null,
      lastPlayedAt: last,
    });
  });

  // Games that only exist for the cabinet / rarest panels: one earned trophy each, long ago.
  const wanted = [
    ...CABINET.map((t) => ({ ...t, type: "platinum" as TrophyType })),
    ...RAREST.map((t, k) => ({ ...t, type: TYPE_OF[RAREST_TYPES[k]] as TrophyType })),
  ];
  const extras = wanted.filter((t) => !idByName.has(t.g));
  extras.forEach((t, k) => {
    const id = `NPWR_SEED_X${String(k + 1).padStart(2, "0")}`;
    idByName.set(t.g, id);
    const at = new Date(Date.UTC(2017, 0, 15) + k * 140 * DAY);
    addTrophy(id, t.type, t.n, "Seeded trophy.", t.r, at);
    titleRows.push({
      npCommunicationId: id,
      npServiceName: "trophy",
      name: t.g,
      iconUrl: `https://seed.invalid/game/${id}.png`,
      platforms: ["PS4"],
      trophySetVersion: "01.00",
      definedPlatinum: t.type === "platinum" ? 1 : 0,
      definedGold: t.type === "gold" ? 1 : 0,
      definedSilver: t.type === "silver" ? 1 : 0,
      earnedPlatinum: t.type === "platinum" ? 1 : 0,
      earnedGold: t.type === "gold" ? 1 : 0,
      earnedSilver: t.type === "silver" ? 1 : 0,
      progress: 100,
      lastTrophyAt: at,
      firstTrophyAt: at,
      psnLastUpdatedAt: at,
      lastPlayedAt: at,
    });
  });

  const cabinetRows = CABINET.map((t, k) => {
    const titleId = idByName.get(t.g)!;
    const row = trophyRows.find((r) => r.titleId === titleId && r.name === t.n);
    if (!row) throw new Error(`seed trophy not found: ${t.n}`);
    return { position: k + 1, titleId, trophyId: row.trophyId };
  });

  await db.delete(cabinet);
  await db.delete(trophies);
  await db.delete(trophyGroups);
  await db.delete(titles);
  await db.insert(titles).values(titleRows);
  for (let i = 0; i < trophyRows.length; i += 500) {
    await db.insert(trophies).values(trophyRows.slice(i, i + 500));
  }
  await db.insert(cabinet).values(cabinetRows);
  await db.update(profile).set({
    accountId: "seed-account",
    onlineId: "Zmx969",
    avatarUrl: null,
    level: 536,
    levelProgress: 42,
    tier: 6,
    earnedPlatinum: 230,
    earnedGold: 990,
    earnedSilver: 2434,
    earnedBronze: 7968,
    updatedAt: new Date(),
  });

  console.log(
    `Seeded ${titleRows.length} games, ${trophyRows.length} trophies, ${cabinetRows.length} cabinet entries.`,
  );
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
