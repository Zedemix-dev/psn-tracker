import { NextResponse } from "next/server";
import { isAuthenticated } from "@/src/auth/require-session";
import { getDb } from "@/src/db/client";
import { queryTrophyLog } from "@/src/trophy-log/load";
import { parseLogQuery, parsePaging } from "@/src/trophy-log/query";

/** The next pages of the Trophy Log, and "Show all" (`all=1`). */
export async function GET(req: Request): Promise<Response> {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const db = await getDb();
  return NextResponse.json(await queryTrophyLog(db, parseLogQuery(searchParams), parsePaging(searchParams)));
}
