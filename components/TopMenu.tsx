"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { edgeFades, scrollToShow } from "@/components/tab-strip";

const TABS = [
  { href: "/", label: "Games" },
  { href: "/plat-wall", label: "Plat Wall" },
  { href: "/trophy-log", label: "Trophy Log" },
  { href: "/trophy-advisor", label: "Trophy Advisor" },
  { href: "/stats", label: "Stats" },
];
const SETTINGS = "/settings";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || pathname.startsWith("/games/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TopMenu() {
  const pathname = usePathname();
  const current = (href: string) => (isActive(pathname, href) ? "page" : undefined);
  const nav = useRef<HTMLElement>(null);
  const [fades, setFades] = useState({ fl: false, fr: false });

  const wasOverflowing = useRef(false);

  const reveal = useCallback(() => {
    const el = nav.current;
    if (!el) return;
    const tab = el.querySelector<HTMLElement>("[aria-current]");
    const to = tab ? scrollToShow(el, { left: tab.offsetLeft, width: tab.offsetWidth }) : null;
    if (to !== null) el.scrollLeft = to;
  }, []);

  const measure = useCallback(() => {
    const el = nav.current;
    if (!el) return;
    wasOverflowing.current = el.scrollWidth > el.clientWidth + 1;
    const next = edgeFades(el);
    setFades((f) => (f.fl === next.fl && f.fr === next.fr ? f : next));
  }, []);

  // Bring the current tab into view, then measure the fades.
  useLayoutEffect(() => {
    reveal();
    measure();
  }, [pathname, reveal, measure]);

  useEffect(() => {
    const el = nav.current;
    if (!el) return;
    el.addEventListener("scroll", measure, { passive: true });
    // Fitting -> overflowing (rotation, late font swap): bring the current tab back into view.
    const ro = new ResizeObserver(() => {
      const was = wasOverflowing.current;
      const now = el.scrollWidth > el.clientWidth + 1;
      if (now && !was) reveal();
      measure();
    });
    ro.observe(el);
    if (el.lastElementChild) ro.observe(el.lastElementChild);
    return () => {
      el.removeEventListener("scroll", measure);
      ro.disconnect();
    };
  }, [measure, reveal]);

  const cls = `tabs${fades.fl ? " fl" : ""}${fades.fr ? " fr" : ""}`;
  return (
    <header className="topbar">
      <div className="wrap">
        <nav ref={nav} className={cls} aria-label="Pages">
          {TABS.map((t) => (
            <Link key={t.href} className="pill" href={t.href} aria-current={current(t.href)}>
              {t.label}
            </Link>
          ))}
        </nav>
        <Link className="pill set-pill" href={SETTINGS} aria-label="Settings" aria-current={current(SETTINGS)}>
          <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">
            <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
              <circle cx="15" cy="7" r="2" />
              <circle cx="9" cy="17" r="2" />
            </g>
          </svg>
          <span className="set-pill-label">Settings</span>
        </Link>
      </div>
    </header>
  );
}
