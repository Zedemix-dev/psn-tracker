import { NextResponse } from "next/server";
import { isAuthenticated } from "@/src/auth/require-session";
import { getDb } from "@/src/db/client";
import { hasValidPaging, parseGameQuery, queryGames } from "@/src/games/query";
import { getSettings } from "@/src/settings/repo";

export async function GET(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = await getDb();
  const { hideZero } = await getSettings(db);
  const { searchParams } = new URL(req.url);
  if (!hasValidPaging(searchParams)) {
    return NextResponse.json({ error: "Invalid offset or limit" }, { status: 400 });
  }
  const query = parseGameQuery(searchParams);
  // hasValidPaging has checked it: empty, or a safe non-negative integer.
  const limit = searchParams.get("limit");
  return NextResponse.json(
    await queryGames(db, query, {
      hideZero,
      all: searchParams.get("all") === "1",
      limit: limit ? Number(limit) : undefined,
    }),
  );
}
