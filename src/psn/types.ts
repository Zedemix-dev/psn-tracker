export type PsnTokens = {
  accessToken: string;
  accessExpiresAt: Date;
  refreshToken: string;
  refreshExpiresAt: Date;
};

export type StoredPsnTokens = PsnTokens & { npssoSetAt: Date | null };

export type TrophyType = "platinum" | "gold" | "silver" | "bronze";
export type TrophyCounts = Record<TrophyType, number>;
export type TitleRef = { npCommunicationId: string; npServiceName: "trophy" | "trophy2" };

export type RemoteTitle = TitleRef & {
  name: string;
  iconUrl: string;
  platforms: string[];
  trophySetVersion: string;
  hasTrophyGroups: boolean;
  defined: TrophyCounts;
  earned: TrophyCounts;
  progress: number;
  hidden: boolean;
  lastUpdatedAt: Date | null;
};

export type RemoteGroup = { groupId: string; name: string; iconUrl: string; defined: TrophyCounts };

export type RemoteTrophyDef = {
  trophyId: number;
  groupId: string;
  type: TrophyType;
  name: string;
  detail: string;
  iconUrl: string;
  hidden: boolean;
};

export type RemoteUserTrophy = {
  trophyId: number;
  earned: boolean;
  earnedAt: Date | null;
  earnedRate: number | null;
  rareCategory: number | null;
  progressTarget: string | null;
};

export type RemotePlayedGame = {
  npTitleId: string;
  name: string;
  imageUrl: string;
  playSeconds: number;
  playCount: number;
  firstPlayedAt: Date | null;
  lastPlayedAt: Date | null;
};

export type RemoteSummary = {
  accountId: string;
  level: number;
  levelProgress: number;
  tier: number;
  earned: TrophyCounts;
};

export type RemoteProfile = { onlineId: string; avatarUrl: string };
