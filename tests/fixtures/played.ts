import type { RemotePlayedGame } from "@/src/psn/types";

export function makePlayedGame(overrides: Partial<RemotePlayedGame> = {}): RemotePlayedGame {
  return {
    npTitleId: "PPSA00001_00",
    name: "Test Game",
    imageUrl: "https://img.example/cover.png",
    playSeconds: 3600,
    playCount: 1,
    firstPlayedAt: new Date("2025-01-01T00:00:00Z"),
    lastPlayedAt: new Date("2025-01-02T00:00:00Z"),
    concept: null,
    ...overrides,
  };
}
