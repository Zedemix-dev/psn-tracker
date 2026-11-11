"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setAdvisorDlcMode, toggleAdvisorHideUnobtainable } from "@/app/(site)/actions";
import type { AdvisorDlc } from "@/src/db/schema";

/** The three settings of the Trophy Advisor. The two DLC toggles are one setting: turning one on turns the other off. */
export function AdvisorToggles({ hideUnobtainable, dlc }: { hideUnobtainable: boolean; dlc: AdvisorDlc }) {
  const router = useRouter();
  const [unobtainable, setUnobtainable] = useState(hideUnobtainable);
  const [mode, setMode] = useState<AdvisorDlc>(dlc);
  const [pending, startTransition] = useTransition();

  function changeUnobtainable(next: boolean) {
    setUnobtainable(next);
    startTransition(async () => {
      try {
        await toggleAdvisorHideUnobtainable(next);
        router.refresh();
      } catch {
        setUnobtainable(!next);
      }
    });
  }

  function changeDlc(next: AdvisorDlc) {
    const before = mode;
    setMode(next);
    startTransition(async () => {
      try {
        await setAdvisorDlcMode(next);
        router.refresh();
      } catch {
        setMode(before);
      }
    });
  }

  return (
    <>
      <label className="toggle">
        <input
          type="checkbox"
          checked={unobtainable}
          disabled={pending}
          onChange={(e) => changeUnobtainable(e.target.checked)}
        />
        <span className="track" aria-hidden="true" />
        Hide unobtainable
      </label>
      <label className="toggle">
        <input
          type="checkbox"
          checked={mode === "hide"}
          disabled={pending}
          onChange={(e) => changeDlc(e.target.checked ? "hide" : "all")}
        />
        <span className="track" aria-hidden="true" />
        Hide DLC
      </label>
      <label className="toggle">
        <input
          type="checkbox"
          checked={mode === "only"}
          disabled={pending}
          onChange={(e) => changeDlc(e.target.checked ? "only" : "all")}
        />
        <span className="track" aria-hidden="true" />
        DLC only
      </label>
    </>
  );
}
