import type {
  RemoteGroup,
  RemoteTitle,
  RemoteTrophyDef,
  RemoteUserTrophy,
  TrophyType,
} from "@/src/psn/types";

export const ZERO_COUNTS = { platinum: 0, gold: 0, silver: 0, bronze: 0 };

export function makeRemoteTitle(overrides: Partial<RemoteTitle> = {}): RemoteTitle {
  return {
    npCommunicationId: "NPWR00001_00",
    npServiceName: "trophy",
    name: "Test Game",
    iconUrl: "https://img.example/icon.png",
    platforms: ["PS5"],
    trophySetVersion: "1.00",
    hasTrophyGroups: false,
    defined: { ...ZERO_COUNTS, bronze: 3 },
    earned: { ...ZERO_COUNTS },
    progress: 0,
    hidden: false,
    lastUpdatedAt: null,
    ...overrides,
  };
}

export function makeGroup(groupId: string, overrides: Partial<RemoteGroup> = {}): RemoteGroup {
  return {
    groupId,
    name: groupId === "default" ? "Base game" : `DLC ${groupId}`,
    iconUrl: "https://img.example/group.png",
    defined: { ...ZERO_COUNTS },
    ...overrides,
  };
}

/** n trophies with ids start..start+n-1 in `groupId`, all of one type, and matching user states. */
export function makeTrophies(
  n: number,
  opts: { groupId?: string; start?: number; earnedIds?: number[]; type?: TrophyType } = {},
): { defs: RemoteTrophyDef[]; userTrophies: RemoteUserTrophy[] } {
  const { groupId = "default", start = 0, earnedIds = [], type = "bronze" } = opts;
  const defs: RemoteTrophyDef[] = [];
  const userTrophies: RemoteUserTrophy[] = [];
  for (let i = start; i < start + n; i++) {
    defs.push({
      trophyId: i,
      groupId,
      type,
      name: `Trophy ${i}`,
      detail: `Do thing ${i}`,
      iconUrl: `https://img.example/t${i}.png`,
      hidden: false,
      progressTarget: null,
    });
    const earned = earnedIds.includes(i);
    userTrophies.push({
      trophyId: i,
      earned,
      earnedAt: earned ? new Date(Date.UTC(2024, 0, 1 + i)) : null,
      earnedRate: 12.345,
      rareCategory: 2,
      progress: null,
      progressedAt: null,
    });
  }
  return { defs, userTrophies };
}
