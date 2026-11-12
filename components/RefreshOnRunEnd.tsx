"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { SyncStatus } from "@/src/sync/requests";

const ACTIVE_MS = 3000;
// While idle, a slow poll notices a sync that starts (the 6-hourly one, or from another tab).
const IDLE_MS = 60_000;

/**
 * Polls the lightweight /api/sync and redraws the server page only when a run ends
 * (lastFinishedAt changes), instead of re-rendering it on every tick.
 */
export function RefreshOnRunEnd({ active: initialActive, lastFinishedAt }: { active: boolean; lastFinishedAt: string | null }) {
  const router = useRouter();
  const [active, setActive] = useState(initialActive);
  const lastSeen = useRef(lastFinishedAt);

  useEffect(() => {
    const timer = setInterval(
      async () => {
        if (document.hidden) return;
        try {
          const res = await fetch("/api/sync", { cache: "no-store" });
          if (!res.ok) return;
          const next: SyncStatus = await res.json();
          setActive(next.status === "queued" || next.status === "running");
          // A run ended, possibly entirely between two idle polls: redraw once.
          if (next.lastFinishedAt !== lastSeen.current) {
            lastSeen.current = next.lastFinishedAt;
            router.refresh();
          }
        } catch {
          // Network blip: keep polling.
        }
      },
      active ? ACTIVE_MS : IDLE_MS,
    );
    return () => clearInterval(timer);
  }, [active, router]);
  return null;
}
