/** Headers for every response of the site: it must never be rendered inside a frame. */
export const SITE_HEADERS: { key: string; value: string }[] = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

/** Files under /media may be user-influenced (SVG): they cannot run any script. Images in <img> still display. */
export const MEDIA_CSP = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
