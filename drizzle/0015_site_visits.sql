CREATE TABLE "site_visits" (
	"day" date NOT NULL,
	"visitor_id" uuid NOT NULL,
	"device" text NOT NULL,
	"views" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "site_visits_day_visitor_id_pk" PRIMARY KEY("day","visitor_id")
);
--> statement-breakpoint
ALTER TABLE "site_visits" ENABLE ROW LEVEL SECURITY;