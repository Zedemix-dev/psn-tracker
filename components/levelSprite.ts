import type { CSSProperties } from "react";

/** Row `tier` (1 at the top, 10 at the bottom) of the 10-tier level sprite. */
export function levelSpriteStyle(tier: number): CSSProperties {
  const t = Math.min(10, Math.max(1, Math.round(tier)));
  return {
    backgroundImage: "url(/icons/level-sprite.png)",
    backgroundSize: "100% 1000%",
    backgroundPosition: `0 ${((t - 1) / 9) * 100}%`,
  };
}
