ALTER TABLE "settings" ADD COLUMN "advisor_hide_unobtainable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "advisor_dlc" text DEFAULT 'all' NOT NULL;