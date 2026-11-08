CREATE TABLE "cabinet" (
	"position" integer PRIMARY KEY NOT NULL,
	"title_id" text NOT NULL,
	"trophy_id" integer NOT NULL,
	CONSTRAINT "cabinet_position_range" CHECK ("cabinet"."position" between 1 and 10)
);
--> statement-breakpoint
CREATE TABLE "images" (
	"url" text PRIMARY KEY NOT NULL,
	"local_path" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"fetched_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "job_state" (
	"key" text PRIMARY KEY NOT NULL,
	"last_run_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "played_games" (
	"np_title_id" text PRIMARY KEY NOT NULL,
	"np_communication_ids" text[],
	"name" text NOT NULL,
	"image_url" text,
	"play_seconds" integer DEFAULT 0 NOT NULL,
	"play_count" integer DEFAULT 0 NOT NULL,
	"first_played_at" timestamp with time zone,
	"last_played_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"account_id" text,
	"online_id" text,
	"avatar_url" text,
	"level" integer,
	"level_progress" integer,
	"tier" integer,
	"earned_platinum" integer DEFAULT 0 NOT NULL,
	"earned_gold" integer DEFAULT 0 NOT NULL,
	"earned_silver" integer DEFAULT 0 NOT NULL,
	"earned_bronze" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"hide_zero" boolean DEFAULT false NOT NULL,
	"banner_path" text,
	"banner_pos_y" integer DEFAULT 50 NOT NULL,
	"npsso_enc" text,
	"npsso_set_at" timestamp with time zone,
	"refresh_token_enc" text,
	"refresh_expires_at" timestamp with time zone,
	"access_token_enc" text,
	"access_expires_at" timestamp with time zone,
	"psn_auth_status" text DEFAULT 'missing' NOT NULL,
	"sync_requested_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"titles_total" integer DEFAULT 0 NOT NULL,
	"titles_done" integer DEFAULT 0 NOT NULL,
	"trophies_updated" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "titles" (
	"np_communication_id" text PRIMARY KEY NOT NULL,
	"np_service_name" text NOT NULL,
	"name" text NOT NULL,
	"icon_url" text NOT NULL,
	"cover_url" text,
	"platforms" text[] NOT NULL,
	"trophy_set_version" text NOT NULL,
	"has_trophy_groups" boolean DEFAULT false NOT NULL,
	"defined_platinum" integer DEFAULT 0 NOT NULL,
	"defined_gold" integer DEFAULT 0 NOT NULL,
	"defined_silver" integer DEFAULT 0 NOT NULL,
	"defined_bronze" integer DEFAULT 0 NOT NULL,
	"earned_platinum" integer DEFAULT 0 NOT NULL,
	"earned_gold" integer DEFAULT 0 NOT NULL,
	"earned_silver" integer DEFAULT 0 NOT NULL,
	"earned_bronze" integer DEFAULT 0 NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"last_trophy_at" timestamp with time zone,
	"first_trophy_at" timestamp with time zone,
	"play_seconds" integer,
	"play_count" integer,
	"last_played_at" timestamp with time zone,
	"synced_at" timestamp with time zone,
	"groups_checked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "trophies" (
	"title_id" text NOT NULL,
	"trophy_id" integer NOT NULL,
	"group_id" text DEFAULT 'default' NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"detail" text,
	"icon_url" text NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"earned" boolean DEFAULT false NOT NULL,
	"earned_at" timestamp with time zone,
	"earned_rate" numeric(6, 2),
	"rare_category" integer,
	"progress_target" text,
	CONSTRAINT "trophies_title_id_trophy_id_pk" PRIMARY KEY("title_id","trophy_id")
);
--> statement-breakpoint
CREATE TABLE "trophy_groups" (
	"title_id" text NOT NULL,
	"group_id" text NOT NULL,
	"name" text NOT NULL,
	"icon_url" text,
	"defined_platinum" integer DEFAULT 0 NOT NULL,
	"defined_gold" integer DEFAULT 0 NOT NULL,
	"defined_silver" integer DEFAULT 0 NOT NULL,
	"defined_bronze" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "trophy_groups_title_id_group_id_pk" PRIMARY KEY("title_id","group_id")
);
--> statement-breakpoint
ALTER TABLE "cabinet" ADD CONSTRAINT "cabinet_title_id_titles_np_communication_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("np_communication_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trophies" ADD CONSTRAINT "trophies_title_id_titles_np_communication_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("np_communication_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trophy_groups" ADD CONSTRAINT "trophy_groups_title_id_titles_np_communication_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("np_communication_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trophies_earned_at_idx" ON "trophies" USING btree ("earned_at");