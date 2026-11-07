"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, sessionCookieOptions } from "@/src/auth/cookie";
import { verifyLogin } from "@/src/auth/password";
import { createLoginLimiter } from "@/src/auth/rate-limit";
import { createSession } from "@/src/auth/sessions";
import { getDb } from "@/src/db/client";
import { getConfig } from "@/src/lib/config";

const limiter = createLoginLimiter({ max: 5, windowMs: 15 * 60_000 });

export async function login(_prev: string | null, formData: FormData): Promise<string | null> {
  const h = await headers();
  const ip = h.get("x-real-ip") ?? "unknown";
  if (!limiter.check(ip, Date.now())) {
    return "Too many attempts. Try again in 15 minutes.";
  }
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!(await verifyLogin(username, password, getConfig()))) {
    limiter.fail(ip, Date.now());
    return "Wrong username or password.";
  }
  limiter.reset(ip);
  const id = await createSession(await getDb(), new Date());
  (await cookies()).set(SESSION_COOKIE, id, sessionCookieOptions(h.get("x-forwarded-proto")));
  redirect("/");
}
