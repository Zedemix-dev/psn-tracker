INSERT INTO "settings" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
INSERT INTO "profile" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;
