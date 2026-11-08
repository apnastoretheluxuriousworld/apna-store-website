CREATE TYPE "public"."notification_type" AS ENUM('order', 'payment', 'review');--> statement-breakpoint
CREATE TABLE "admin_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"href" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "admin_notifications_created_at_index" ON "admin_notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "admin_notifications_read_at_index" ON "admin_notifications" USING btree ("read_at");