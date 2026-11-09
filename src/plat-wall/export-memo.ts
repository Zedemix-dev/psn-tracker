export const EXPORT_TTL_MS = 600_000;

// One image, in memory only: nothing is ever written to disk.
let slot: { key: string; png: Buffer } | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

export function forgetExport(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  slot = null;
}

/** Keeps `png` for its key, replacing any previous image, and forgets it after EXPORT_TTL_MS. */
export function rememberExport(key: string, png: Buffer): void {
  forgetExport();
  slot = { key, png };
  timer = setTimeout(forgetExport, EXPORT_TTL_MS);
  timer.unref();
}

export function recallExport(key: string): Buffer | null {
  return slot && slot.key === key ? slot.png : null;
}
