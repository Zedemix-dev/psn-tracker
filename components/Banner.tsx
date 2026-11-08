import Link from "next/link";

const clampPct = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

/** CSS custom properties that carry the banner image to `.hero-img` and `.page-bg`. */
export function bannerVars(
  bannerPath: string | null,
  bannerPosY: number,
): Record<`--${string}`, string> {
  return {
    "--banner": bannerPath ? `url("/media/${encodeURI(bannerPath)}")` : "none",
    "--banner-y": `${clampPct(bannerPosY)}%`,
  };
}

export function Banner({
  hasImage,
  label = "Custom banner",
  logo,
}: {
  hasImage: boolean;
  label?: string;
  logo?: { src: string; alt: string } | null;
}) {
  return (
    <div className="hero">
      {hasImage ? (
        <div className="hero-img" role="img" aria-label={label} />
      ) : (
        <div className="hero-img hero-empty">
          <Link className="pill" href="/settings">
            Choose a banner in Settings
          </Link>
        </div>
      )}
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="hero-logo" src={logo.src} alt={logo.alt} />
      )}
    </div>
  );
}

/** Fixed, blurred copy of the banner behind the whole page. */
export function PageBackground() {
  return <div className="page-bg" aria-hidden="true" />;
}
