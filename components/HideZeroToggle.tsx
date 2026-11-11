"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleHideZero } from "@/app/(site)/actions";

export function HideZeroToggle({ checked }: { checked: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(checked);
  const [pending, startTransition] = useTransition();

  function change(next: boolean) {
    // Ignore a second click while saving; the input stays enabled so it keeps keyboard focus.
    if (pending) return;
    setOn(next);
    startTransition(async () => {
      try {
        await toggleHideZero(next);
        router.refresh();
      } catch {
        setOn(!next);
      }
    });
  }

  return (
    <label className="toggle">
      <input type="checkbox" checked={on} aria-busy={pending} onChange={(e) => change(e.target.checked)} />
      <span className="track" aria-hidden="true" />
      Hide 0% games
    </label>
  );
}
