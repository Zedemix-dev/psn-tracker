import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/src/db/client";
import { SESSION_COOKIE } from "@/src/auth/cookie";
import { validateSession } from "@/src/auth/sessions";

export { SESSION_COOKIE };

/** For route handlers (app/api, app/media): answer 401 when false. */
export async function isAuthenticated(): Promise<boolean> {
  const id = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!id) return false;
  return validateSession(await getDb(), id, new Date());
}

/** For pages and layouts: redirects to /login when there is no valid session. */
export async function requireSession(): Promise<void> {
  if (!(await isAuthenticated())) redirect("/login");
}
