CREATE TABLE "unobtainable_list" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"entries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"downloaded_at" timestamp with time zone,
	"attempted_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "unobtainable_list_url" text DEFAULT 'https://psnp-plus.huskycode.dev/list.json' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "unobtainable_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "titles" ADD COLUMN "unobtainable_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "titles" ADD COLUMN "unobtainable_note" text;--> statement-breakpoint
ALTER TABLE "trophies" ADD COLUMN "unobtainable" boolean DEFAULT false NOT NULL;