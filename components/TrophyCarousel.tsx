"use client";

import { useEffect, useRef, useState, type FocusEvent, type PointerEvent } from "react";
import { fitCount } from "@/components/carousel-fit";
import { TrophyTypeIcon } from "@/components/TrophyTypeIcon";
import type { TrophyType } from "@/src/db/schema";
import styles from "./TrophyCarousel.module.css";

export { fitCount } from "@/components/carousel-fit";

/** JSON-safe: built on the server, so no Date reaches the client. */
export type CarouselTrophy = {
  key: string;
  name: string;
  detail: string;
  game: string;
  when: string;
  iconSrc: string;
  type: TrophyType;
  ratePct: string | null;
  tier: string | null;
};

const DELAY = 6000;
const TYPE_LABEL: Record<TrophyType, string> = {
  platinum: "Platinum",
  gold: "Gold",
  silver: "Silver",
  bronze: "Bronze",
};

export function TrophyCarousel({ trophies }: { trophies: CarouselTrophy[] }) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(trophies.length);
  const [hovered, setHovered] = useState(false);
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  const [touching, setTouching] = useState(false);
  // A tap fires compatibility mouse events (mouseenter now, mouseleave only on a later tap
  // elsewhere): after a touch they must not pause. A real mouse pointer event clears this.
  const touched = useRef(false);
  const paused = hovered || touching || keyboardFocused;
  // Bumped on every manual restart so the timer and its bar start over.
  const [cycle, setCycle] = useState(0);

  const shown = Math.min(visible, trophies.length);
  const current = active < shown ? active : 0;

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const fit = () => {
      const width = strip.clientWidth;
      if (width === 0) return;
      const css = getComputedStyle(strip);
      const num = (v: string) => parseFloat(css.getPropertyValue(v));
      const narrow = window.matchMedia?.("(max-width:980px)").matches ?? false;
      const n = fitCount(width, { icon: num("--icon"), gap: num("--gap"), card: num("--card"), narrow }, trophies.length);
      setVisible(n);
      setActive((a) => (a >= n ? 0 : a));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(strip);
    return () => observer.disconnect();
  }, [trophies.length]);

  useEffect(() => {
    if (paused || shown < 2) return;
    const id = setTimeout(() => setActive((current + 1) % shown), DELAY);
    return () => clearTimeout(id);
  }, [paused, shown, current, cycle]);

  const restart = () => setCycle((c) => c + 1);
  // Only keyboard focus pauses: a mouse click also focuses the button, but must not freeze the carousel.
  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    let visibleFocus = false;
    try {
      visibleFocus = (e.target as Element).matches?.(":focus-visible") ?? false;
    } catch {
      // :focus-visible unsupported
    }
    setKeyboardFocused(visibleFocus);
  };
  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== "touch") return;
    touched.current = true;
    setTouching(true);
  };
  const onTouchEnd = (e: PointerEvent) => {
    if (e.pointerType !== "touch") return;
    setTouching(false);
    restart();
  };
  const onMousePointer = (e: PointerEvent) => {
    if (e.pointerType === "mouse") touched.current = false;
  };
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setKeyboardFocused(false);
    restart();
  };

  if (trophies.length === 0) return null;

  return (
    <div
      ref={stripRef}
      className={styles.strip}
      aria-label="Latest trophies"
      role="group"
      onPointerEnter={onMousePointer}
      onPointerMove={onMousePointer}
      onPointerDown={onPointerDown}
      onPointerUp={onTouchEnd}
      onPointerCancel={onTouchEnd}
      onPointerLeave={onTouchEnd}
      onMouseEnter={() => {
        if (!touched.current) setHovered(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
        restart();
      }}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {trophies.map((t, i) => {
        const on = i === current;
        return (
          <button
            key={t.key}
            type="button"
            className={on ? `${styles.item} ${styles.on}` : styles.item}
            hidden={i >= shown}
            aria-pressed={on}
            title={`${t.name} (${TYPE_LABEL[t.type]})`}
            onClick={() => {
              setActive(i);
              setCycle((c) => c + 1);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.iconSrc} alt={t.name} />
            {on && (
              <>
                <div className={styles.det}>
                  <h4>{t.name}</h4>
                  <div className={styles.desc}>{t.detail}</div>
                  <div className={styles.when}>
                    {t.when} in {t.game}
                  </div>
                </div>
                <div className={styles.rar}>
                  {t.ratePct && (
                    <div>
                      <b>{t.ratePct}</b>
                      {t.tier && <span>{t.tier}</span>}
                    </div>
                  )}
                  <TrophyTypeIcon type={t.type} size={24} />
                </div>
                <i key={`${current}-${cycle}`} className={styles.timer} />
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
