import { formatInt } from "@/src/lib/format";

/** The Details cell of the sync history: the error, else "1,200/1,500 games, 12,434 trophies". */
export function formatRunDetails(run: {
  error: string | null;
  titlesDone: number;
  titlesTotal: number;
  trophiesUpdated: number;
}): string {
  return run.error ?? `${formatInt(run.titlesDone)}/${formatInt(run.titlesTotal)} games, ${formatInt(run.trophiesUpdated)} trophies`;
}
