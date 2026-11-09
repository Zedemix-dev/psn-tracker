"use client";

import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { edgeBackground } from "@/src/lib/tile-bg";

/** Edge colour of a loaded, non-square image, read on a canvas (spec 8.9); null when unavailable. */
function readEdgeBackground(img: HTMLImageElement): string | null {
  const { naturalWidth: w, naturalHeight: h } = img;
  if (!w || !h || w === h) return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return edgeBackground(ctx.getImageData(0, 0, w, h).data, w, h);
  } catch {
    return null;
  }
}

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "style" | "onLoad" | "src" | "alt"> & {
  src: string;
  alt: string;
  /** The image is contained in a square tile: once loaded, the tile takes its edge colour. */
  tile: boolean;
};

/**
 * An <img> whose square tile (CSS default `#0B1022`) takes the image's own edge colour when that edge
 * is one opaque colour, so a contained rectangle and its bands read as a single square (spec 8.9).
 */
export function TileImage({ tile, src, alt, ...rest }: Props) {
  const ref = useRef<HTMLImageElement>(null);
  const [edge, setEdge] = useState<{ src: string; bg: string | null } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!tile || !el) return;
    const update = () => setEdge({ src, bg: readEdgeBackground(el) });
    // An image cached by the browser may finish loading before hydration: no load event then.
    if (el.complete && el.naturalWidth > 0) update();
    el.addEventListener("load", update);
    return () => el.removeEventListener("load", update);
  }, [tile, src]);

  const bg = tile && edge?.src === src ? edge.bg : null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={ref} src={src} alt={alt} {...rest} style={bg ? { background: bg } : undefined} />;
}
