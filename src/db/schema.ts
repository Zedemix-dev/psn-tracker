import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export type TrophyType = "platinum" | "gold" | "silver" | "bronze";
export type SyncKind = "scheduled" | "manual" | "daily" | "first";
export type SyncStatus = "running" | "success" | "error";
export type PsnAuthStatus = "missing" | "valid" | "expired";
export type AdvisorDlc = "all" | "hide" | "only";

export const DEFAULT_UNOBTAINABLE_LIST_URL = "https://psnp-plus.huskycode.dev/list.json";

export type UnobtainableEntry = {
  id: string;
  title: string;
  platforms: string[];
  trophies: number[];
  note: string | null;
  timestamp: number | null;
};

export const profile = pgTable("profile", {
  id: integer("id").primaryKey().default(1),
  accountId: text("account_id"),
  onlineId: text("online_id"),
  avatarUrl: text("avatar_url"),
  level: integer("level"),
  levelProgress: integer("level_progress"),
  tier: integer("tier"),
  earnedPlatinum: integer("earned_platinum").notNull().default(0),
  earnedGold: integer("earned_gold").notNull().default(0),
  earnedSilver: integer("earned_silver").notNull().default(0),
  earnedBronze: integer("earned_bronze").notNull().default(0),
  updatedAt: ts("updated_at"),
});

export const titles = pgTable("titles", {
  npCommunicationId: text("np_communication_id").primaryKey(),
  npServiceName: text("np_service_name").notNull(),
  name: text("name").notNull(),
  iconUrl: text("icon_url").notNull(),
  coverUrl: text("cover_url"),
  platforms: text("platforms").array().notNull(),
  trophySetVersion: text("trophy_set_version").notNull(),
  hasTrophyGroups: boolean("has_trophy_groups").notNull().default(false),
  definedPlatinum: integer("defined_platinum").notNull().default(0),
  definedGold: integer("defined_gold").notNull().default(0),
  definedSilver: integer("defined_silver").notNull().default(0),
  definedBronze: integer("defined_bronze").notNull().default(0),
  earnedPlatinum: integer("earned_platinum").notNull().default(0),
  earnedGold: integer("earned_gold").notNull().default(0),
  earnedSilver: integer("earned_silver").notNull().default(0),
  earnedBronze: integer("earned_bronze").notNull().default(0),
  progress: integer("progress").notNull().default(0),
  hidden: boolean("hidden").notNull().default(false),
  lastTrophyAt: ts("last_trophy_at"),
  psnLastUpdatedAt: ts("psn_last_updated_at"),
  firstTrophyAt: ts("first_trophy_at"),
  playSeconds: integer("play_seconds"),
  playCount: integer("play_count"),
  lastPlayedAt: ts("last_played_at"),
  syncedAt: ts("synced_at"),
  groupsCheckedAt: ts("groups_checked_at"),
  conceptId: integer("concept_id"),
  bannerUrl: text("banner_url"),
  logoUrl: text("logo_url"),
  publisher: text("publisher"),
  genres: text("genres").array(),
  releaseDate: ts("release_date"),
  catalogCheckedAt: ts("catalog_checked_at"),
  unobtainableCount: integer("unobtainable_count").notNull().default(0),
  unobtainableNote: text("unobtainable_note"),
});

export const trophyGroups = pgTable(
  "trophy_groups",
  {
    titleId: text("title_id")
      .notNull()
      .references(() => titles.npCommunicationId, { onDelete: "cascade" }),
    groupId: text("group_id").notNull(),
    name: text("name").notNull(),
    iconUrl: text("icon_url"),
    definedPlatinum: integer("defined_platinum").notNull().default(0),
    definedGold: integer("defined_gold").notNull().default(0),
    definedSilver: integer("defined_silver").notNull().default(0),
    definedBronze: integer("defined_bronze").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.titleId, t.groupId] })],
);

export const trophies = pgTable(
  "trophies",
  {
    titleId: text("title_id")
      .notNull()
      .references(() => titles.npCommunicationId, { onDelete: "cascade" }),
    trophyId: integer("trophy_id").notNull(),
    groupId: text("group_id").notNull().default("default"),
    type: text("type").$type<TrophyType>().notNull(),
    name: text("name").notNull(),
    detail: text("detail"),
    iconUrl: text("icon_url").notNull(),
    hidden: boolean("hidden").notNull().default(false),
    earned: boolean("earned").notNull().default(false),
    earnedAt: ts("earned_at"),
    earnedRate: numeric("earned_rate", { precision: 6, scale: 2 }),
    rareCategory: integer("rare_category"),
    progressTarget: integer("progress_target"),
    progress: integer("progress"),
    progressedAt: ts("progressed_at"),
    unobtainable: boolean("unobtainable").notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.titleId, t.trophyId] }),
    index("trophies_earned_at_idx").on(t.earnedAt),
  ],
);

export const playedGames = pgTable("played_games", {
  npTitleId: text("np_title_id").primaryKey(),
  npCommunicationIds: text("np_communication_ids").array(),
  name: text("name").notNull(),
  imageUrl: text("image_url"),
  playSeconds: integer("play_seconds").notNull().default(0),
  playCount: integer("play_count").notNull().default(0),
  firstPlayedAt: ts("first_played_at"),
  lastPlayedAt: ts("last_played_at"),
  conceptId: integer("concept_id"),
  bannerUrl: text("banner_url"),
  logoUrl: text("logo_url"),
});

export const images = pgTable("images", {
  url: text("url").primaryKey(),
  localPath: text("local_path"),
  thumbPath: text("thumb_path"),
  attempts: integer("attempts").notNull().default(0),
  fetchedAt: ts("fetched_at"),
  tileBg: text("tile_bg"),
  tileCheckedAt: ts("tile_checked_at"),
});

export const syncRuns = pgTable("sync_runs", {
  id: serial("id").primaryKey(),
  kind: text("kind").$type<SyncKind>().notNull(),
  status: text("status").$type<SyncStatus>().notNull().default("running"),
  startedAt: ts("started_at").notNull().defaultNow(),
  finishedAt: ts("finished_at"),
  titlesTotal: integer("titles_total").notNull().default(0),
  titlesDone: integer("titles_done").notNull().default(0),
  trophiesUpdated: integer("trophies_updated").notNull().default(0),
  error: text("error"),
});

export const jobState = pgTable("job_state", {
  key: text("key").primaryKey(),
  lastRunAt: ts("last_run_at"),
});

export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  hideZero: boolean("hide_zero").notNull().default(false),
  advisorHideUnobtainable: boolean("advisor_hide_unobtainable").notNull().default(false),
  advisorDlc: text("advisor_dlc").$type<AdvisorDlc>().notNull().default("all"),
  bannerPath: text("banner_path"),
  bannerPosY: integer("banner_pos_y").notNull().default(50),
  npssoSetAt: ts("npsso_set_at"),
  refreshTokenEnc: text("refresh_token_enc"),
  refreshExpiresAt: ts("refresh_expires_at"),
  accessTokenEnc: text("access_token_enc"),
  accessExpiresAt: ts("access_expires_at"),
  psnAuthStatus: text("psn_auth_status")
    .$type<PsnAuthStatus>()
    .notNull()
    .default("missing"),
  syncRequestedAt: ts("sync_requested_at"),
  unobtainableListUrl: text("unobtainable_list_url")
    .notNull()
    .default(DEFAULT_UNOBTAINABLE_LIST_URL),
  unobtainableRequestedAt: ts("unobtainable_requested_at"),
  psnLanguage: text("psn_language"),
  syncRequestFailures: integer("sync_request_failures").notNull().default(0),
});

export const unobtainableList = pgTable("unobtainable_list", {
  id: integer("id").primaryKey().default(1),
  entries: jsonb("entries").$type<UnobtainableEntry[]>().notNull().default([]),
  downloadedAt: ts("downloaded_at"),
  attemptedAt: ts("attempted_at"),
  error: text("error"),
  appliedAt: ts("applied_at"),
});

export const cabinet = pgTable(
  "cabinet",
  {
    position: integer("position").primaryKey(),
    titleId: text("title_id")
      .notNull()
      .references(() => titles.npCommunicationId, { onDelete: "cascade" }),
    trophyId: integer("trophy_id").notNull(),
  },
  (t) => [check("cabinet_position_range", sql`${t.position} between 1 and 10`)],
);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  createdAt: ts("created_at").notNull().defaultNow(),
  lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
});
