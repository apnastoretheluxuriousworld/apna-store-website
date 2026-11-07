ALTER TABLE "reviews" DROP CONSTRAINT "reviews_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "author_name" text;--> statement-breakpoint
-- Existing customer reviews take the name on their account.
UPDATE "reviews" r SET "author_name" = coalesce((SELECT u."name" FROM "users" u WHERE u."id" = r."user_id"), 'Customer');--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "author_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "media" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "is_pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "is_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reviews_product_id_is_approved_index" ON "reviews" USING btree ("product_id","is_approved");--> statement-breakpoint
CREATE INDEX "reviews_is_approved_created_at_index" ON "reviews" USING btree ("is_approved","created_at");