import { SyncButton } from "@/components/SyncButton";
import { TrophyTypeIcon } from "@/components/TrophyTypeIcon";
import { levelSpriteStyle } from "@/components/levelSprite";
import type { profile } from "@/src/db/schema";
import { formatInt } from "@/src/lib/format";
import { mediaSrc } from "@/src/sync/images";
import type { SyncStatus } from "@/src/sync/requests";

type Profile = typeof profile.$inferSelect;

const COUNTS = [
  { type: "platinum", key: "earnedPlatinum", cls: "plat" },
  { type: "gold", key: "earnedGold", cls: "gold" },
  { type: "silver", key: "earnedSilver", cls: "silver" },
  { type: "bronze", key: "earnedBronze", cls: "bronze" },
] as const;

const LABEL = { platinum: "Platinum", gold: "Gold", silver: "Silver", bronze: "Bronze" } as const;

export function ProfileBand({
  profile,
  imageMap,
  sync,
}: {
  profile: Profile;
  imageMap: Map<string, string>;
  sync: SyncStatus;
}) {
  const name = profile.onlineId ?? "PSN profile";
  const total = COUNTS.reduce((sum, c) => sum + profile[c.key], 0);
  const progress = profile.levelProgress ?? 0;
  return (
    <section className="profile glass" aria-label="Profile">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="avatar" src={mediaSrc(profile.avatarUrl, imageMap)} alt={`${name} avatar`} />
      <div className="identity">
        <h1>{name}</h1>
        <SyncButton initial={sync} />
      </div>
      <div className="counts">
        <div className="count">
          <b>{formatInt(total)}</b>
          <span>Trophies</span>
        </div>
        {COUNTS.map((c) => (
          <div key={c.type} className={`count ${c.cls}`}>
            <b>{formatInt(profile[c.key])}</b>
            <span>
              <TrophyTypeIcon type={c.type} size={11} />
              {LABEL[c.type]}
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
