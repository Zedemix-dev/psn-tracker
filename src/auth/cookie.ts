export const SESSION_COOKIE = "psnt_session";
export const SESSION_MAX_AGE_S = 400 * 24 * 60 * 60;

export function sessionCookieOptions(forwardedProto: string | null | undefined) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_S,
    secure: forwardedProto === "https",
  };
}
