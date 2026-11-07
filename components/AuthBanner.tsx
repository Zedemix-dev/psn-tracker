import Link from "next/link";
import type { PsnAuthStatus } from "@/src/db/schema";

const DAY_MS = 86_400_000;
const WARN_AFTER_DAYS = 50;

/** Alert shown above the page, or null when the PSN token needs no attention. */
export function authBannerText(
  status: PsnAuthStatus,
  npssoSetAt: Date | null,
  now: Date,
): string | null {
  if (status === "expired") return "PSN token expired — update it in Settings";
  if (status === "missing") return "Connect your PSN account in Settings";
  if (!npssoSetAt) return null;
  const days = Math.floor((now.getTime() - npssoSetAt.getTime()) / DAY_MS);
  return days > WARN_AFTER_DAYS ? `PSN token is ${days} days old — renew it in Settings` : null;
}

export function AuthBanner({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <Link className="auth-banner" href="/settings" role="alert">
      {text}
    </Link>
  );
}
