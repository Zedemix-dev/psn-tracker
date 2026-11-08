"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatDateTime } from "@/src/lib/format";
import type { SyncStatus } from "@/src/sync/requests";

const POLL_MS = 2000;
// While idle, a slow poll notices the 6-hourly sync so the open page follows it too.
const IDLE_POLL_MS = 60_000;

const isActive = (s: SyncStatus) => s.status === "queued" || s.status === "running";

export function SyncButton({ initial }: { initial: SyncStatus }) {
  const router = useRouter();
  const [sync, setSync] = useState(initial);
  const active = isActive(sync);
  const lastSuccessAt = sync.lastSuccessAt;

  useEffect(() => {
    const timer = setInterval(
      async () => {
        try {
          const res = await fetch("/api/sync", { cache: "no-store" });
          if (!res.ok) return;
          const next: SyncStatus = await res.json();
          setSync(next);
          // A sync just ended (ours, or one that ran entirely between two idle polls): reload the data.
          const ended = active ? !isActive(next) : !isActive(next) && next.lastSuccessAt !== lastSuccessAt;
          if (ended) router.refresh();
        } catch {
          // Network blip: keep polling.
        }
      },
      active ? POLL_MS : IDLE_POLL_MS,
    );
    return () => clearInterval(timer);
  }, [active, lastSuccessAt, router]);

  async function start() {
    setSync((s) => ({ ...s, status: "queued", error: null }));
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSync(await res.json());
    } catch (e) {
      setSync((s) => ({ ...s, status: "error", error: e instanceof Error ? e.message : "Request failed" }));
    }
  }

  const when =
    sync.status === "error"
      ? `Last sync failed: ${sync.error ?? "Unknown error"}`
      : sync.lastSuccessAt
        ? `Last synced ${formatDateTime(new Date(sync.lastSuccessAt))}`
        : "Never synced";
  const label = active ? "Syncing…" : sync.status === "error" ? "Retry sync" : "Sync now";

  return (
    <div className="sync-row">
      <span className="sync-when">{when}</span>
      <button type="button" className={`btn-sync${active ? " busy" : ""}`} disabled={active} onClick={start}>
        <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20 12a8 8 0 0 1-14.3 4.9M4 12A8 8 0 0 1 18.3 7.1M18.5 3v4.5H14M5.5 21v-4.5H10"
          />
        </svg>
        <span>{label}</span>
      </button>
    </div>
  );
}
