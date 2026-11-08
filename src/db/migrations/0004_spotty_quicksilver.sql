ALTER TABLE "trophies" ALTER COLUMN "progress_target" SET DATA TYPE integer USING NULLIF(trim("progress_target"), '')::integer;--> statement-breakpoint
ALTER TABLE "played_games" ADD COLUMN "concept_id" integer;--> statement-breakpoint
ALTER TABLE "played_games" ADD COLUMN "banner_url" text;--> statement-breakpoint
ALTER TABLE "played_games" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "titles" ADD COLUMN "concept_id" integer;--> statement-breakpoint
ALTER TABLE "titles" ADD COLUMN "banner_url" text;--> statement-breakpoint
ALTER TABLE "titles" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "titles" ADD COLUMN "publisher" text;--> statement-breakpoint
ALTER TABLE "titles" ADD COLUMN "genres" text[];--> statement-breakpoint
ALTER TABLE "titles" ADD COLUMN "release_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "titles" ADD COLUMN "catalog_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trophies" ADD COLUMN "progress" integer;--> statement-breakpoint
ALTER TABLE "trophies" ADD COLUMN "progressed_at" timestamp with time zone;