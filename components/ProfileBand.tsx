import { SyncButton } from "@/components/SyncButton";
import { TrophyTypeIcon } from "@/components/TrophyTypeIcon";
import { levelSpriteStyle } from "@/components/levelSprite";
import type { profile } from "@/src/db/schema";
import { profileCounterValues } from "@/src/stats/stat-tile-values";
import { type ImageMap, mediaSrc } from "@/src/sync/images";
import type { SyncStatus } from "@/src/sync/requests";

type Profile = typeof profile.$inferSelect;

const COUNT_CLASS = { platinum: "plat", gold: "gold", silver: "silver", bronze: "bronze" } as const;

export function ProfileBand({
  profile,
  imageMap,
  sync,
}: {
  profile: Profile;
  imageMap: ImageMap;
  sync: SyncStatus;
}) {
  const name = profile.onlineId ?? "PSN profile";
  const counters = profileCounterValues({
    platinum: profile.earnedPlatinum,
    gold: profile.earnedGold,
    silver: profile.earnedSilver,
    bronze: profile.earnedBronze,
  });
  const progress = profile.levelProgress ?? 0;
  return (
    <section className="profile glass" aria-label="Profile">
      {/* eslint-disable-next-line @next/next/no-img-element -- images are already cached and sized by the app, no next/image optimizer wanted */}
      <img className="avatar" src={mediaSrc(profile.avatarUrl, imageMap)} alt={`${name} avatar`} />
      <div className="identity">
        <h1>{name}</h1>
        <SyncButton initial={sync} />
      </div>
      <div className="counts">
        {counters.map((c) => (
          <div key={c.label} className={c.type ? `count ${COUNT_CLASS[c.type]}` : "count total"}>
            <b>{c.value}</b>
            <span>
              {c.type && <TrophyTypeIcon type={c.type} size={11} />}
              {c.label}
            </span>
          </div>
        ))}
      </div>
      {profile.level != null && (
        <div className="level">
          <div
            className="lvl-icon"
            style={levelSpriteStyle(profile.tier ?? 1)}
            role="img"
            aria-label="PSN level icon"
          />
          <div>
            <div className="lv">
              <small>PSN level</small>
              {profile.level}
            </div>
            <div className="next">
              <i style={{ width: `${progress}%` }} />
            </div>
            <div className="next-label">
              {progress}% to level {profile.level + 1}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
