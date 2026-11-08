import { NextResponse } from "next/server";
import { isAuthenticated } from "@/src/auth/require-session";
import { getDb } from "@/src/db/client";
import { parseGameQuery, queryGames } from "@/src/games/query";
import { getSettings } from "@/src/settings/repo";

export async function GET(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const { hideZero } = await getSettings(db);
  const query = parseGameQuery(new URL(req.url).searchParams);
  return NextResponse.json(await queryGames(db, query, { hideZero }));
}
