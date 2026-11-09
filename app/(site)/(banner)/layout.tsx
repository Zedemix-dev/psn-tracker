import type { CSSProperties } from "react";
import { Banner, PageBackground, bannerVars } from "@/components/Banner";
import { getDb } from "@/src/db/client";
import { getPageBanner } from "@/src/settings/page-banner";

export default async function BannerLayout({ children }: { children: React.ReactNode }) {
  const banner = await getPageBanner(await getDb());
  return (
    <div style={bannerVars(banner?.path ?? null, banner?.posY ?? 50) as CSSProperties}>
      {banner && <PageBackground />}
      <Banner
        hasImage={banner !== null}
        label={banner?.source === "auto" ? `Banner of ${banner.gameName}` : "Custom banner"}
      />
      {children}
    </div>
  );
}
