import type { CSSProperties } from "react";
import { Banner, PageBackground, bannerVars } from "@/components/Banner";
import { getDb } from "@/src/db/client";
import { getSettings } from "@/src/settings/repo";

export default async function BannerLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings(await getDb());
  return (
    <div style={bannerVars(s.bannerPath, s.bannerPosY) as CSSProperties}>
      {s.bannerPath && <PageBackground />}
      <Banner hasImage={Boolean(s.bannerPath)} />
      {children}
    </div>
  );
}
