"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const ACTIVE_MS = 3000;
// While idle, a slow refresh notices a sync that starts (the 6-hourly one, or from another tab).
const IDLE_MS = 60_000;

/** Re-renders the server page on a timer: every 3 s while a sync is queued or running, every minute otherwise. */
export function AutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(
      () => {
        if (!document.hidden) router.refresh();
      },
      active ? ACTIVE_MS : IDLE_MS,
    );
    return () => clearInterval(timer);
  }, [active, router]);
  return null;
}
