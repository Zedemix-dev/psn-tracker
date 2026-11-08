import { AuthBanner, authBannerText } from "@/components/AuthBanner";
import { TopMenu } from "@/components/TopMenu";
import { requireSession } from "@/src/auth/require-session";
import { getDb } from "@/src/db/client";
import { getSettings } from "@/src/settings/repo";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  const s = await getSettings(await getDb());
  const alert = authBannerText(s.psnAuthStatus, s.npssoSetAt, new Date());
  return (
    <div>
      <AuthBanner text={alert} />
      <div className="shell-top">
        <TopMenu />
      </div>
      {children}
    </div>
  );
}
