ALTER TABLE "images" ADD COLUMN "tile_bg" text;--> statement-breakpoint
ALTER TABLE "images" ADD COLUMN "tile_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "psn_language" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "sync_request_failures" integer DEFAULT 0 NOT NULL;