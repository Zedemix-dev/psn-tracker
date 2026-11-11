import { type SiblingIndex, withSiblings } from "@/src/games/siblings";
import { type ImageMap, mediaSrc } from "@/src/sync/images";

export type GameImage = { gameSrc: string; gameIsIcon: boolean };

/**
 * The image of a game's row in Games (as toGameRow gives it), worked out once per game.
 * A title missing from the index (hidden between two reads) gets the placeholder.
 */
export function gameImages(siblings: SiblingIndex, imageMap: ImageMap): (titleId: string) => GameImage {
  const titleById = new Map([...siblings.values()].flat().map((t) => [t.npCommunicationId, t]));
  const cache = new Map<string, GameImage>();
  return (titleId) => {
    let image = cache.get(titleId);
    if (!image) {
      const title = titleById.get(titleId);
      const info = title && withSiblings(title, siblings);
      image = {
        gameSrc: mediaSrc(info ? (info.coverUrl ?? info.coverFallbackUrl) : null, imageMap),
        gameIsIcon: info ? info.coverIsIcon : false,
      };
      cache.set(titleId, image);
    }
    return image;
  };
}
