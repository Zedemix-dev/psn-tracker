import { desc } from "drizzle-orm";
import { AutoRefresh } from "@/components/AutoRefresh";
import { BannerForm, NpssoForm, UnobtainableForm } from "@/components/SettingsForms";
import { requireSession } from "@/src/auth/require-session";
import { getDb } from "@/src/db/client";
import { syncRuns } from "@/src/db/schema";
import { formatDate, formatDateTime, formatDuration } from "@/src/lib/format";
import { getPageBanner } from "@/src/settings/page-banner";
import { getSettings } from "@/src/settings/repo";
import { getSyncStatus } from "@/src/sync/requests";
import { getUnobtainableStatus } from "@/src/unobtainable/status";
import { logout } from "./actions";

const STATUS_LABEL = { valid: "Valid", expired: "Expired", missing: "Not connected" } as const;
const DAY_MS = 24 * 60 * 60 * 1000;

export default async function SettingsPage() {
  await requireSession();
  const db = await getDb();
  const [s, runs, sync, pageBanner, unobt] = await Promise.all([
    getSettings(db),
    db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt), desc(syncRuns.id)).limit(20),
    getSyncStatus(db),
    getPageBanner(db),
    getUnobtainableStatus(db),
  ]);
  // eslint-disable-next-line react-hooks/purity -- async Server Component, rendered once per request: the age is read at request time on purpose
  const age = s.npssoSetAt ? Math.floor((Date.now() - s.npssoSetAt.getTime()) / DAY_MS) : null;

  return (
    <main className="wrap set-page">
      {/* Keeps the token status and the sync history live (first sync progress, 6-hourly syncs). */}
      <AutoRefresh active={sync.status === "queued" || sync.status === "running" || unobt.busy} />
      <section className="panel glass" aria-label="Banner">
        <div className="panel-head">
          <h2>Banner</h2>
        </div>
        <BannerForm
          bannerUrl={s.bannerPath ? `/media/${encodeURI(s.bannerPath)}` : null}
          posY={s.bannerPosY}
          auto={
            pageBanner?.source === "auto" && pageBanner.gameName
              ? { url: `/media/${encodeURI(pageBanner.path)}`, gameName: pageBanner.gameName }
              : null
          }
        />
      </section>

      <section className="panel glass" aria-label="PSN token">
        <div className="panel-head">
          <h2>PSN token</h2>
        </div>
        <div className="set-body">
          <p className="set-status">
            <span className={`set-badge ${s.psnAuthStatus}`}>{STATUS_LABEL[s.psnAuthStatus]}</span>
            {s.npssoSetAt && age !== null && (
              <span className="set-muted">
                Saved {formatDate(s.npssoSetAt)} · {age} {age === 1 ? "day" : "days"} old
              </span>
            )}
          </p>
          <NpssoForm />
          <ol className="set-tuto">
            <li>
              Sign in at{" "}
              <a href="https://www.playstation.com" target="_blank" rel="noopener noreferrer">
                https://www.playstation.com
              </a>{" "}
              in your browser.
            </li>
            <li>
              In the same browser, open{" "}
              <a href="https://ca.account.sony.com/api/v1/ssocookie" target="_blank" rel="noopener noreferrer">
                https://ca.account.sony.com/api/v1/ssocookie
              </a>
              .
            </li>
            <li>Copy the value of &quot;npsso&quot; (64 characters).</li>
            <li>Paste it here and save.</li>
          </ol>
        </div>
      </section>

      <section className="panel glass" aria-label="Unobtainable trophies">
        <div className="panel-head">
          <h2>Unobtainable trophies</h2>
        </div>
        <div className="set-body">
          <p className="set-status">
            <span className={`set-badge ${unobt.badgeClass}`.trim()}>{unobt.badge}</span>
            {unobt.detail && <span className="set-muted">{unobt.detail}</span>}
          </p>
          <UnobtainableForm url={unobt.url} />
        </div>
      </section>

      <section className="panel glass" aria-label="Sync history">
        <div className="panel-head">
          <h2>Sync history</h2>
        </div>
        {runs.length === 0 ? (
          <p className="empty">No sync yet.</p>
        ) : (
          <div className="set-table-wrap">
            <table className="set-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Started</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td>{r.kind}</td>
                    <td>{formatDateTime(r.startedAt)}</td>
                    <td>
                      {r.finishedAt
                        ? formatDuration((r.finishedAt.getTime() - r.startedAt.getTime()) / 1000)
                        : "—"}
                    </td>
                    <td>{r.status}</td>
                    <td>{r.error ?? `${r.titlesDone}/${r.titlesTotal} games, ${r.trophiesUpdated} trophies`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel glass" aria-label="Log out">
        <div className="panel-head">
          <h2>Log out</h2>
        </div>
        <form action={logout} className="set-body">
          <button type="submit" className="set-btn ghost">
            Log out
          </button>
        </form>
      </section>
    </main>
  );
}
