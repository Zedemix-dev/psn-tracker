import { eq } from "drizzle-orm";
import type { Db } from "@/src/db/client";
import { titles } from "@/src/db/schema";
import { bannerOverrideFor } from "@/src/games/banner-overrides";
import type { GameTitle } from "@/src/games/row";

export type SiblingTitle = GameTitle;

export type GameInfo = {
  coverUrl: string | null;
  bannerUrl: string | null;
  logoUrl: string | null;
  publisher: string | null;
  genres: string[] | null;
  releaseDate: Date | null;
};

/** Visible titles, grouped by game key. */
export type SiblingIndex = Map<string, SiblingTitle[]>;

/** Same game across platforms: lower case, no ™ ® ©, single spaces, trimmed. */
export function gameKey(name: string): string {
  return name.toLowerCase().replace(/[™®©]/g, "").replace(/\s+/g, " ").trim();
}

export async function loadSiblingIndex(db: Db): Promise<SiblingIndex> {
  const rows = await db.select().from(titles).where(eq(titles.hidden, false));
  const index: SiblingIndex = new Map();
  for (const row of rows) {
    const key = gameKey(row.name);
    const list = index.get(key);
    if (list) list.push(row);
    else index.set(key, [row]);
  }
  return index;
}

const isPs5 = (t: SiblingTitle) => t.platforms.includes("PS5");

/** Lenders order: PS5 first, then most recently played, then by id. */
function compareLenders(a: SiblingTitle, b: SiblingTitle): number {
  if (isPs5(a) !== isPs5(b)) return isPs5(a) ? -1 : 1;
  const ta = a.lastPlayedAt?.getTime() ?? -Infinity;
  const tb = b.lastPlayedAt?.getTime() ?? -Infinity;
  if (ta !== tb) return ta > tb ? -1 : 1;
  return a.npCommunicationId < b.npCommunicationId ? -1 : a.npCommunicationId > b.npCommunicationId ? 1 : 0;
}

export function withSiblings(
  title: GameTitle,
  index: SiblingIndex,
): GameInfo & { coverIsIcon: boolean; coverFallbackUrl: string; bannerIsOverride: boolean } {
  const others = (index.get(gameKey(title.name)) ?? [])
    .filter((t) => t.npCommunicationId !== title.npCommunicationId)
    .sort(compareLenders);

  function pick<T>(own: T | null | undefined, from: (t: SiblingTitle) => T | null | undefined): T | null {
    const present = (v: T | null | undefined): v is T =>
      v != null && !(Array.isArray(v) && v.length === 0);
    if (present(own)) return own;
    for (const t of others) {
      const v = from(t);
      if (present(v)) return v;
    }
    return null;
  }

  const coverUrl = pick(title.coverUrl, (t) => t.coverUrl);
  let coverFallbackUrl = title.iconUrl;
  let iconIsSquare = true;
  if (coverUrl == null && !isPs5(title) && title.platforms.includes("PS4")) {
    const ps5 = others.find(isPs5);
    if (ps5) {
      coverFallbackUrl = ps5.iconUrl;
      iconIsSquare = false;
    }
  }

  // Banner priority: own, another version's, then the hand-picked one (shown without logo).
  const psnBannerUrl = pick(title.bannerUrl, (t) => t.bannerUrl);
  const overrideUrl = psnBannerUrl == null ? bannerOverrideFor(title.name) : null;

  return {
    coverUrl,
    bannerUrl: psnBannerUrl ?? overrideUrl,
    bannerIsOverride: overrideUrl != null,
    logoUrl: overrideUrl != null ? null : pick(title.logoUrl, (t) => t.logoUrl),
    publisher: pick(title.publisher, (t) => t.publisher),
    genres: pick(title.genres, (t) => t.genres),
    releaseDate: pick(title.releaseDate, (t) => t.releaseDate),
    coverIsIcon: coverUrl == null && iconIsSquare,
    coverFallbackUrl,
  };
}
