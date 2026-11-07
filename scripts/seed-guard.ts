/** The seed wipes titles and trophies: only run it on a local database, or with --force. */
export function isSafeSeedTarget(url: string, argv: string[]): boolean {
  if (argv.includes("--force")) return true;
  if (url.startsWith("pglite:")) return true;
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}
