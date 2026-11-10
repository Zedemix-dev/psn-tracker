import { NextResponse } from "next/server";
import { isAuthenticated } from "@/src/auth/require-session";
import { getDb } from "@/src/db/client";
import { getSettings } from "@/src/settings/repo";
import { advisorScope, queryAdvisor } from "@/src/trophy-advisor/load";
import { parseAdvisorQuery } from "@/src/trophy-advisor/query";
import { parsePaging } from "@/src/trophy-log/query";

/** The next pages of the Trophy Advisor, and "Show all" (`all=1`). The settings come from the database. */
export async function GET(req: Request): Promise<Response> {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const db = await getDb();
  const scope = advisorScope(await getSettings(db));
  return NextResponse.json(await queryAdvisor(db, parseAdvisorQuery(searchParams), scope, parsePaging(searchParams)));
}
