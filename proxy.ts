import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/src/auth/cookie";

// Optimistic check only (cookie presence, no DB). requireSession() validates for real.
export function proxy(request: NextRequest) {
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
  matcher: ["/((?!login|_next|favicon.ico).*)"],
};
