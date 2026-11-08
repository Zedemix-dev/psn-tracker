import type { CSSProperties } from "react";
import { AuthBanner, authBannerText } from "@/components/AuthBanner";
import { Banner, PageBackground, bannerVars } from "@/components/Banner";
import { TopMenu } from "@/components/TopMenu";
import { requireSession } from "@/src/auth/require-session";
import { getDb } from "@/src/db/client";
import { getSettings } from "@/src/settings/repo";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  const s = await getSettings(await getDb());
  const alert = authBannerText(s.psnAuthStatus, s.npssoSetAt, new Date());
  return (
    <div style={bannerVars(s.bannerPath, s.bannerPosY) as CSSProperties}>
      {s.bannerPath && <PageBackground />}
      <AuthBanner text={alert} />
      <div className="shell-top">
        <TopMenu />
        <Banner hasImage={Boolean(s.bannerPath)} />
      </div>
      {children}
    </div>
  );
}
