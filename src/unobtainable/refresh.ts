import { eq } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { settings, unobtainableList } from "@/src/db/schema";
import { clearUnobtainableRequest } from "@/src/settings/repo";
import { applyUnobtainable } from "./apply";
import { LIST_INVALID, LIST_UNREACHABLE, isListUrl, parseList, type ParsedList } from "./list";

const HOUR = 60 * 60 * 1000;
const TIMEOUT_MS = 30_000;
const MAX_BYTES = 10 * 1024 * 1024;

type DueState = { requestedAt: Date | null; downloadedAt: Date | null; attemptedAt: Date | null };

/** Requested, or never downloaded, or last success 24 h old; at most one attempt per hour unless requested. */
export function isListDue(s: DueState, now: Date): boolean {
  if (s.requestedAt) return true;
  if (s.attemptedAt && now.getTime() - s.attemptedAt.getTime() < HOUR) return false;
  if (!s.downloadedAt) return true;
  return now.getTime() - s.downloadedAt.getTime() >= 24 * HOUR;
}

async function readBody(res: Response): Promise<string | null> {
  if (!res.body) return null;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function downloadList(url: string, fetchImpl: typeof fetch = fetch): Promise<ParsedList> {
  if (!isListUrl(url)) return { ok: false, error: LIST_UNREACHABLE };
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return { ok: false, error: LIST_UNREACHABLE };
    const text = await readBody(res);
    if (text === null) return { ok: false, error: LIST_INVALID };
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return { ok: false, error: LIST_INVALID };
    }
    return parseList(raw);
  } catch {
    return { ok: false, error: LIST_UNREACHABLE };
  }
}

export async function refreshUnobtainableListIfDue(
  db: Db,
  now: Date,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const [s] = await db
    .select({ url: settings.unobtainableListUrl, requestedAt: settings.unobtainableRequestedAt })
    .from(settings)
    .where(eq(settings.id, 1));
  const [list] = await db
    .select({ downloadedAt: unobtainableList.downloadedAt, attemptedAt: unobtainableList.attemptedAt })
    .from(unobtainableList)
    .where(eq(unobtainableList.id, 1));
  if (!s) return;
  if (!isListDue({ requestedAt: s.requestedAt, downloadedAt: list?.downloadedAt ?? null, attemptedAt: list?.attemptedAt ?? null }, now)) {
    return;
  }

  const result = await downloadList(s.url, fetchImpl);
  let failure: string | null = result.ok ? null : result.error;
  if (result.ok) {
    try {
      // One transaction: a list that cannot be stored or applied leaves the previous one in place.
      await db.transaction(async (tx) => {
        const set = { entries: result.entries, downloadedAt: now, attemptedAt: now, error: null };
        await tx
          .insert(unobtainableList)
          .values({ id: 1, ...set })
          .onConflictDoUpdate({ target: unobtainableList.id, set });
        await applyUnobtainable(tx);
      });
    } catch {
      failure = LIST_INVALID;
    }
  }
  if (failure !== null) {
    const set = { attemptedAt: now, error: failure };
    await db
      .insert(unobtainableList)
      .values({ id: 1, entries: [], ...set })
      .onConflictDoUpdate({ target: unobtainableList.id, set });
  }
  if (s.requestedAt) await clearUnobtainableRequest(db, s.requestedAt);
}
