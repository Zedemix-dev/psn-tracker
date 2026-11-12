ALTER TABLE "unobtainable_list" ADD COLUMN "applied_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "settings" DROP COLUMN "npsso_enc";