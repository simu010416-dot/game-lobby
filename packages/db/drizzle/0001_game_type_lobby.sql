DROP TABLE IF EXISTS "room_game_queue";--> statement-breakpoint
ALTER TABLE "rooms" DROP COLUMN IF EXISTS "current_game";--> statement-breakpoint
ALTER TABLE "rooms" DROP COLUMN IF EXISTS "queue_mode";--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "game_type" varchar(32) NOT NULL DEFAULT 'undercover';--> statement-breakpoint
ALTER TABLE "rooms" ALTER COLUMN "game_type" DROP DEFAULT;
