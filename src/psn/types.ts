export type PsnTokens = {
  accessToken: string;
  accessExpiresAt: Date;
  refreshToken: string;
  refreshExpiresAt: Date;
};

export type StoredPsnTokens = PsnTokens & { npssoSetAt: Date | null };
