import { gameKey } from "@/src/games/siblings";

/** Banners chosen by hand for games no PSN version has a banner for (spec 8.9), keyed by gameKey(name). */
export const BANNER_OVERRIDES: Record<string, string> = {
  dauntless: "https://img.psnprofiles.com/hero/l/14795/05bf48f1-d893-41d8-b1f7-1ea0bfcc3bc0.jpg",
  "game of thrones": "https://img.psnprofiles.com/hero/l/3220/31500c21-cc5e-4d31-bfcc-9c10cbb55249.jpg",
  "marvel heroes omega": "https://img.psnprofiles.com/hero/l/6161/6206b90b-f266-4134-9f8c-5ff112d3d403.jpg",
  "minecraft: story mode": "https://img.psnprofiles.com/hero/l/3955/c7fb42f7-3b15-4f07-99c5-eb92fcdeee57.jpg",
  "tales from the borderlands": "https://img.psnprofiles.com/hero/l/3188/a4a61b38-7893-4131-b936-5cb8effce3e1.jpg",
};

export function bannerOverrideFor(name: string): string | null {
  return BANNER_OVERRIDES[gameKey(name)] ?? null;
}
