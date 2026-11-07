"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, sessionCookieOptions } from "@/src/auth/cookie";
import { loginAttempt } from "@/src/auth/login";
import { verifyLogin } from "@/src/auth/password";
import { createLoginLimiter } from "@/src/auth/rate-limit";
import { createSession } from "@/src/auth/sessions";
import { getDb } from "@/src/db/client";
import { getConfig } from "@/src/lib/config";

const limiter = createLoginLimiter({ max: 5, windowMs: 15 * 60_000 });

export async function login(_prev: string | null, formData: FormData): Promise<string | null> {
  const h = await headers();
  const ip = h.get("x-real-ip") ?? "unknown";
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const outcome = await loginAttempt({
    ip,
    now: Date.now(),
    limiter,
    verify: () => verifyLogin(username, password, getConfig()),
  });
  if (outcome === "blocked") return "Too many attempts. Try again in 15 minutes.";
  if (outcome === "invalid") return "Wrong username or password.";
  const id = await createSession(await getDb(), new Date());
  (await cookies()).set(SESSION_COOKIE, id, sessionCookieOptions(h.get("x-forwarded-proto")));
  redirect("/");
}
