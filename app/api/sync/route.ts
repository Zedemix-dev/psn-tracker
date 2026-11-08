import { NextResponse } from "next/server";
import { isAuthenticated } from "@/src/auth/require-session";
import { getDb } from "@/src/db/client";
import { requestSync } from "@/src/settings/repo";
import { getSyncStatus } from "@/src/sync/requests";

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

export async function GET() {
  if (!(await isAuthenticated())) return unauthorized();
  return NextResponse.json(await getSyncStatus(await getDb()));
}

export async function POST() {
  if (!(await isAuthenticated())) return unauthorized();
  const db = await getDb();
  if ((await getSyncStatus(db)).status !== "running") await requestSync(db, new Date());
  return NextResponse.json(await getSyncStatus(db), { status: 202 });
}
