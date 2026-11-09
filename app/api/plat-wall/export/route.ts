import { NextResponse } from "next/server";
import { isAuthenticated } from "@/src/auth/require-session";
import { getDb } from "@/src/db/client";
import { loadExportInput } from "@/src/plat-wall/export-input";
import { recallExport, rememberExport } from "@/src/plat-wall/export-memo";
import { renderPlatWallPng } from "@/src/plat-wall/export-render";
import { arePlatParamsValid, parsePlatQuery, platQueryParams } from "@/src/plat-wall/query";
import { getConfig } from "@/src/lib/config";

export async function GET(req: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  if (!arePlatParamsValid(searchParams)) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }
  const query = parsePlatQuery(searchParams);
  const key = platQueryParams(query).toString();
  const download = searchParams.get("download") === "1";

  const loaded = await loadExportInput(await getDb(), query, getConfig().mediaDir);
  if (!loaded) return NextResponse.json({ error: "No platinum trophies match" }, { status: 404 });

  // A preview always renders again; only a download reuses the remembered image.
  let png = download ? recallExport(key) : null;
  if (!png) {
    png = await renderPlatWallPng(loaded.input);
    rememberExport(key, png);
  }
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${loaded.fileName}"`,
    },
  });
}
