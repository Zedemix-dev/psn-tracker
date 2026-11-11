import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/src/auth/cookie";
import { getDb } from "@/src/db/client";
import { isDbReady } from "@/src/db/readiness";

const WAIT_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="5">
<title>Updating…</title>
<style>body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui,sans-serif;background:#0b0f19;color:#e5e7eb}h1{font-size:1.5rem;margin:0 0 .5rem}p{margin:0;color:#9ca3af}</style>
</head>
<body>
<h1>Updating…</h1>
<p>This page reloads by itself.</p>
</body>
</html>`;

async function dbReady(): Promise<boolean> {
  try {
    return await isDbReady(await getDb());
  } catch {
    return false;
  }
}

// Until the worker has applied every migration this build knows, answer 503
// (a layout would render in parallel with its page, so only the proxy can stop it).
// Otherwise: optimistic check only (cookie presence, no session lookup).
// requireSession() validates for real.
export async function proxy(request: NextRequest) {
  if (!(await dbReady())) {
    if (request.nextUrl.pathname.startsWith("/api")) {
      return new NextResponse(null, { status: 503 });
    }
    return new NextResponse(WAIT_PAGE, {
      status: 503,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  }
  if (/^\/login(?:\/|$)/.test(request.nextUrl.pathname)) {
    return NextResponse.next();
  }
  const id = request.cookies.get(SESSION_COOKIE)?.value;
  if (!id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  const response = NextResponse.next();
  response.cookies.set(
    SESSION_COOKIE,
    id,
    sessionCookieOptions(request.headers.get("x-forwarded-proto")),
  );
  return response;
}

export const config = {
  matcher: ["/((?!media(?:/|$)|_next/static|_next/image|favicon\\.ico$).*)"],
};
