/** Headers for every response of the site: never rendered inside a frame, referrer kept same-origin, no MIME sniffing. */
export const SITE_HEADERS: { key: string; value: string }[] = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
];

/** Files under /media may be user-influenced (SVG): they cannot run any script. Images in <img> still display. */
export const MEDIA_CSP = "default-src 'none'; style-src 'unsafe-inline'; sandbox; frame-ancestors 'none'";
