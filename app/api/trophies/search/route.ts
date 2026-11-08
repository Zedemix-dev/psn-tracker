import { NextResponse } from "next/server";
import { isAuthenticated } from "@/src/auth/require-session";
import { toTrophyItem } from "@/src/cabinet/item";
import { searchEarnedTrophies } from "@/src/cabinet/repo";
import { getDb } from "@/src/db/client";
import { loadImageMap } from "@/src/sync/images";

export async function GET(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const db = await getDb();
  const [found, imageMap] = await Promise.all([searchEarnedTrophies(db, q), loadImageMap(db)]);
  return NextResponse.json(found.map((t) => toTrophyItem(t, imageMap)));
}
