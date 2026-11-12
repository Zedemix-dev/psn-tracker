import type { ImgHTMLAttributes } from "react";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "style" | "src" | "alt"> & {
  src: string;
  alt: string;
  /** The image is contained in a square tile: the tile takes the colour `bg`. */
  tile: boolean;
  /** The stored edge colour of the image (the worker computes it, spec 19.6.1); null: keep the CSS default. */
  bg: string | null;
};

/**
 * An <img> whose square tile (CSS default `#0B1022`) is painted with the image's own edge colour from the
 * very first render, so a contained rectangle and its bands read as a single square (spec 8.9).
 */
export function TileImage({ tile, bg, src, alt, ...rest }: Props) {
  // eslint-disable-next-line @next/next/no-img-element -- images are already cached and sized by the app, no next/image optimizer wanted
  return <img src={src} alt={alt} {...rest} style={tile && bg ? { background: bg } : undefined} />;
}
